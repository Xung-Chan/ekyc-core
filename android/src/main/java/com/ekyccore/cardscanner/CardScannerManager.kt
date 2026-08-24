package com.ekyccore.cardscanner

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.exifinterface.media.ExifInterface
import org.opencv.android.OpenCVLoader
import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfDouble
import org.opencv.core.MatOfPoint
import org.opencv.core.Rect
import org.opencv.imgcodecs.Imgcodecs
import org.opencv.imgproc.Imgproc
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.math.max

class CardScannerManager private constructor(private val context: Context) {

    private val executor = Executors.newSingleThreadExecutor()

    @Volatile
    private var openCvReady = false
    private var eventListener: CardScannerEventListener? = null
    private var lastProcessedTimestamp = 0L

    companion object {
        private const val LOG_TAG = "EkycCardScanner"

        @Volatile
        private var instance: CardScannerManager? = null

        fun getInstance(context: Context): CardScannerManager {
            val existing = instance
            if (existing != null) {
                return existing
            }
            return synchronized(this) {
                instance ?: CardScannerManager(context.applicationContext).also { instance = it }
            }
        }

        private val TEMP_FILE_PREFIXES =
            arrayOf(
                "card_manual_crop_",
                "card_scan_",
                "ekyc_card_warp_",
                "img_cmp_",
                "img_src_",
            )
    }

    data class CropJpegOnlyResult(
        val success: Boolean,
        val croppedAbsolutePath: String?,
        val appliedX: Int,
        val appliedY: Int,
        val appliedW: Int,
        val appliedH: Int,
        val errorCode: String?,
        val errorMessage: String?,
        val debugDecodedWidth: Int = 0,
        val debugDecodedHeight: Int = 0,
        val debugExifOrientation: Int? = null,
        val debugNormalizedWidth: Int? = null,
        val debugNormalizedHeight: Int? = null,
        val debugCropCoordinateSpace: String = "raw",
        val debugBufferOrientation: String? = null,
        val debugExpectedUprightWidth: Int? = null,
        val debugExpectedUprightHeight: Int? = null,
        val debugSkippedUprightRotation: Boolean = false,
        val debugSourcePhotoWidth: Int = 0,
        val debugSourcePhotoHeight: Int = 0,
    )

    interface CardScannerEventListener {
        fun onCardCaptured(
            croppedImagePath: String,
            blurScore: Double,
            glarePercent: Double,
            appliedX: Int,
            appliedY: Int,
            appliedWidth: Int,
            appliedHeight: Int
        )

        fun onCardCaptureFailed(errorCode: String, errorMessage: String)
    }

    interface CropCallback {
        fun onSuccess(result: Map<String, Any>)
        fun onFailure(errorCode: String, errorMessage: String, debugDetails: Map<String, Any>?)
    }

    interface CleanupCallback {
        fun onSuccess(deleted: Int, skipped: Int)
        fun onFailure(throwable: Throwable)
    }

    fun setEventListener(listener: CardScannerEventListener?) {
        this.eventListener = listener
    }

    // --- Pipeline Crop Methods ---

    fun cropJpegOnly(
        originalPath: String,
        cropX: Int,
        cropY: Int,
        cropW: Int,
        cropH: Int,
        cropCoordinateSpace: String = "raw",
        bufferOrientation: String? = null,
        sourcePhotoWidth: Int = 0,
        sourcePhotoHeight: Int = 0,
    ): CropJpegOnlyResult {
        if (!initOpenCv()) {
            return CropJpegOnlyResult(
                success = false,
                croppedAbsolutePath = null,
                appliedX = 0,
                appliedY = 0,
                appliedW = 0,
                appliedH = 0,
                errorCode = "OPEN_CV_NOT_AVAILABLE",
                errorMessage = "Failed to initialize OpenCV native runtime",
            )
        }
        if (cropW <= 0 || cropH <= 0) {
            return CropJpegOnlyResult(
                success = false,
                croppedAbsolutePath = null,
                appliedX = 0,
                appliedY = 0,
                appliedW = 0,
                appliedH = 0,
                errorCode = "INVALID_INPUT",
                errorMessage = "crop width and height must be positive",
            )
        }
        val useUpright = cropCoordinateSpace == "upright"
        if (useUpright && bufferOrientation.isNullOrBlank()) {
            return CropJpegOnlyResult(
                success = false,
                croppedAbsolutePath = null,
                appliedX = 0,
                appliedY = 0,
                appliedW = 0,
                appliedH = 0,
                errorCode = "INVALID_INPUT",
                errorMessage = "bufferOrientation required for upright crop",
            )
        }
        if (useUpright && (sourcePhotoWidth < 2 || sourcePhotoHeight < 2)) {
            return CropJpegOnlyResult(
                success = false,
                croppedAbsolutePath = null,
                appliedX = 0,
                appliedY = 0,
                appliedW = 0,
                appliedH = 0,
                errorCode = "INVALID_INPUT",
                errorMessage = "sourcePhotoWidth and sourcePhotoHeight (>=2) required for upright crop",
            )
        }
        val path = stripFileScheme(originalPath)
        val exifTag = readExifOrientationTag(path)
        val original = Imgcodecs.imread(path)
        if (original.empty()) {
            original.release()
            return CropJpegOnlyResult(
                success = false,
                croppedAbsolutePath = null,
                appliedX = 0,
                appliedY = 0,
                appliedW = 0,
                appliedH = 0,
                errorCode = "IMAGE_LOAD_FAILED",
                errorMessage = "OpenCV could not decode image",
                debugExifOrientation = exifTag,
            )
        }
        val decW = original.cols()
        val decH = original.rows()
        Log.i(
            LOG_TAG,
            "nativeCrop decoded=${decW}x${decH} exifOrientation=${exifTag ?: "none"} " +
                    "cropSpace=$cropCoordinateSpace bufferOrient=${bufferOrientation ?: "-"}",
        )

        var work: Mat? = null
        var sub: Mat? = null
        var cloned: Mat? = null
        try {
            val base: Mat
            val nW: Int?
            val nH: Int?
            var skippedUprightRotate = false
            var expW = 0
            var expH = 0
            if (useUpright) {
                val (eW, eH) =
                    expectedUprightSize(sourcePhotoWidth, sourcePhotoHeight, bufferOrientation!!)
                expW = eW
                expH = eH
                Log.i(
                    LOG_TAG,
                    "upright beforeRotate=${decW}x${decH} exif=${exifTag ?: "none"} " +
                            "sourcePhoto=${sourcePhotoWidth}x${sourcePhotoHeight} expectedUpright=${expW}x${expH} " +
                            "cropRect=($cropX,$cropY ${cropW}x${cropH}) bufferOrient=$bufferOrientation",
                )
                work =
                    when {
                        decW == expW && decH == expH -> {
                            skippedUprightRotate = true
                            Log.i(
                                LOG_TAG,
                                "upright skipRotate=true (decoded already matches JS upright; no double-EXIF rotate)",
                            )
                            Mat().also { original.copyTo(it) }
                        }

                        decW == sourcePhotoWidth && decH == sourcePhotoHeight -> {
                            Log.i(LOG_TAG, "upright rotate from PhotoFile raw buffer dimensions")
                            normalizeToUprightMat(original, bufferOrientation)
                        }

                        else -> {
                            Log.w(
                                LOG_TAG,
                                "imread ${decW}x${decH} differs from sourcePhoto ${sourcePhotoWidth}x${sourcePhotoHeight}; " +
                                        "normalizeToUpright from decoded buffer",
                            )
                            normalizeToUprightMat(original, bufferOrientation)
                        }
                    }
                original.release()
                val bw = work!!.cols()
                val bh = work!!.rows()
                if (bw != expW || bh != expH) {
                    work.release()
                    work = null
                    return CropJpegOnlyResult(
                        success = false,
                        croppedAbsolutePath = null,
                        appliedX = 0,
                        appliedY = 0,
                        appliedW = 0,
                        appliedH = 0,
                        errorCode = "UPRIGHT_SPACE_MISMATCH",
                        errorMessage = "Bitmap after normalize is ${bw}x${bh}, expected upright ${expW}x${expH} (crop rect is in JS upright space)",
                        debugDecodedWidth = decW,
                        debugDecodedHeight = decH,
                        debugExifOrientation = exifTag,
                        debugExpectedUprightWidth = expW,
                        debugExpectedUprightHeight = expH,
                        debugSkippedUprightRotation = skippedUprightRotate,
                        debugSourcePhotoWidth = sourcePhotoWidth,
                        debugSourcePhotoHeight = sourcePhotoHeight,
                        debugCropCoordinateSpace = cropCoordinateSpace,
                        debugBufferOrientation = bufferOrientation,
                    )
                }
                Log.i(
                    LOG_TAG,
                    "upright assert ok bitmap=${bw}x${bh} == expectedUpright skipRotate=$skippedUprightRotate finalCropSpace=upright",
                )
                base = work
                nW = bw
                nH = bh
            } else {
                base = original
                nW = null
                nH = null
            }

            val W = base.cols()
            val H = base.rows()
            if (useUpright && (W != expW || H != expH)) {
                Log.e(
                    LOG_TAG,
                    "upright internal mismatch bitmap=${W}x${H} expectedUpright=${expW}x${expH} — abort crop",
                )
                work?.release()
                work = null
                return CropJpegOnlyResult(
                    success = false,
                    croppedAbsolutePath = null,
                    appliedX = 0,
                    appliedY = 0,
                    appliedW = 0,
                    appliedH = 0,
                    errorCode = "UPRIGHT_INTERNAL_MISMATCH",
                    errorMessage = "Bitmap ${W}x${H} != expected upright ${expW}x${expH}",
                    debugDecodedWidth = decW,
                    debugDecodedHeight = decH,
                    debugExifOrientation = exifTag,
                    debugNormalizedWidth = W,
                    debugNormalizedHeight = H,
                    debugExpectedUprightWidth = expW,
                    debugExpectedUprightHeight = expH,
                    debugSkippedUprightRotation = skippedUprightRotate,
                    debugSourcePhotoWidth = sourcePhotoWidth,
                    debugSourcePhotoHeight = sourcePhotoHeight,
                    debugCropCoordinateSpace = cropCoordinateSpace,
                    debugBufferOrientation = bufferOrientation,
                )
            }
            val x = cropX.coerceIn(0, max(0, W - 1))
            val y = cropY.coerceIn(0, max(0, H - 1))
            val w = cropW.coerceIn(1, max(1, W - x))
            val h = cropH.coerceIn(1, max(1, H - y))
            Log.i(
                LOG_TAG,
                "crop applied on bitmap ${W}x${H} rect=($x,$y ${w}x${h})",
            )
            sub = Mat(base, Rect(x, y, w, h))
            cloned = sub.clone()

            if (!isDocumentPresent(cloned)) {
                return CropJpegOnlyResult(
                    success = false,
                    croppedAbsolutePath = null,
                    appliedX = x,
                    appliedY = y,
                    appliedW = w,
                    appliedH = h,
                    errorCode = "NO_DOCUMENT_FOUND",
                    errorMessage = "Không tìm thấy giấy tờ trong khung hình",
                    debugDecodedWidth = decW,
                    debugDecodedHeight = decH,
                    debugExifOrientation = exifTag,
                    debugNormalizedWidth = nW ?: decW,
                    debugNormalizedHeight = nH ?: decH,
                    debugCropCoordinateSpace = cropCoordinateSpace,
                    debugBufferOrientation = bufferOrientation,
                    debugExpectedUprightWidth = if (useUpright) expW else null,
                    debugExpectedUprightHeight = if (useUpright) expH else null,
                    debugSkippedUprightRotation = skippedUprightRotate,
                    debugSourcePhotoWidth = if (useUpright) sourcePhotoWidth else 0,
                    debugSourcePhotoHeight = if (useUpright) sourcePhotoHeight else 0,
                )
            }

            val outFile = File(context.cacheDir, "card_manual_crop_${UUID.randomUUID()}.jpg")
            if (!Imgcodecs.imwrite(outFile.absolutePath, cloned)) {
                return CropJpegOnlyResult(
                    success = false,
                    croppedAbsolutePath = null,
                    appliedX = x,
                    appliedY = y,
                    appliedW = w,
                    appliedH = h,
                    errorCode = "ENCODE_FAILED",
                    errorMessage = "Failed to write cropped JPEG",
                    debugDecodedWidth = decW,
                    debugDecodedHeight = decH,
                    debugExifOrientation = exifTag,
                    debugNormalizedWidth = nW,
                    debugNormalizedHeight = nH,
                    debugCropCoordinateSpace = cropCoordinateSpace,
                    debugBufferOrientation = bufferOrientation,
                    debugExpectedUprightWidth = if (useUpright) expW else null,
                    debugExpectedUprightHeight = if (useUpright) expH else null,
                    debugSkippedUprightRotation = skippedUprightRotate,
                    debugSourcePhotoWidth = if (useUpright) sourcePhotoWidth else 0,
                    debugSourcePhotoHeight = if (useUpright) sourcePhotoHeight else 0,
                )
            }
            return CropJpegOnlyResult(
                success = true,
                croppedAbsolutePath = outFile.absolutePath,
                appliedX = x,
                appliedY = y,
                appliedW = w,
                appliedH = h,
                errorCode = null,
                errorMessage = null,
                debugDecodedWidth = decW,
                debugDecodedHeight = decH,
                debugExifOrientation = exifTag,
                debugNormalizedWidth = nW ?: decW,
                debugNormalizedHeight = nH ?: decH,
                debugCropCoordinateSpace = cropCoordinateSpace,
                debugBufferOrientation = bufferOrientation,
                debugExpectedUprightWidth = if (useUpright) expW else null,
                debugExpectedUprightHeight = if (useUpright) expH else null,
                debugSkippedUprightRotation = if (useUpright) skippedUprightRotate else false,
                debugSourcePhotoWidth = if (useUpright) sourcePhotoWidth else 0,
                debugSourcePhotoHeight = if (useUpright) sourcePhotoHeight else 0,
            )
        } finally {
            cloned?.release()
            sub?.release()
            if (useUpright) {
                work?.release()
            } else if (!original.empty()) {
                original.release()
            }
        }
    }

    fun cropCardImage(
        imagePath: String,
        cx: Int,
        cy: Int,
        cw: Int,
        ch: Int,
        cropCoordinateSpace: String,
        bufferOrientation: String?,
        sourcePhotoW: Int,
        sourcePhotoH: Int,
        debugGallery: Boolean,
        callback: CropCallback
    ) {
        executor.execute {
            try {
                val r =
                    cropJpegOnly(
                        imagePath,
                        cx,
                        cy,
                        cw,
                        ch,
                        cropCoordinateSpace,
                        bufferOrientation,
                        sourcePhotoW,
                        sourcePhotoH,
                    )

                val debugDetails = mutableMapOf<String, Any>().apply {
                    put("cropCoordinateSpace", r.debugCropCoordinateSpace)
                    put("decodedWidth", r.debugDecodedWidth)
                    put("decodedHeight", r.debugDecodedHeight)
                    r.debugExifOrientation?.let { put("exifOrientation", it) }
                    r.debugNormalizedWidth?.let { put("normalizedWidth", it) }
                    r.debugNormalizedHeight?.let { put("normalizedHeight", it) }
                    r.debugBufferOrientation?.let { put("bufferOrientation", it) }
                    r.debugExpectedUprightWidth?.let { put("expectedUprightWidth", it) }
                    r.debugExpectedUprightHeight?.let { put("expectedUprightHeight", it) }
                    put("skippedUprightRotation", r.debugSkippedUprightRotation)
                    if (r.debugSourcePhotoWidth > 0) put("sourcePhotoWidth", r.debugSourcePhotoWidth)
                    if (r.debugSourcePhotoHeight > 0) put("sourcePhotoHeight", r.debugSourcePhotoHeight)
                }

                if (!r.success) {
                    callback.onFailure(
                        r.errorCode ?: "CROP_FAILED",
                        r.errorMessage ?: "Crop failed",
                        debugDetails
                    )
                    return@execute
                }

                val croppedAbs = r.croppedAbsolutePath!!
                var debugSaved = false
                if (debugGallery) {
                    debugSaved =
                        ManualCardCaptureDebugSaver.saveFullAndOutline(
                            context.applicationContext,
                            imagePath,
                            r.appliedX,
                            r.appliedY,
                            r.appliedW,
                            r.appliedH,
                        )
                }

                val successMap = mapOf(
                    "success" to true,
                    "originalImagePath" to imagePath,
                    "croppedImagePath" to "file://$croppedAbs",
                    "appliedCrop" to mapOf(
                        "x" to r.appliedX,
                        "y" to r.appliedY,
                        "width" to r.appliedW,
                        "height" to r.appliedH
                    ),
                    "debugSavedToGallery" to debugSaved,
                    "cropDebug" to debugDetails
                )

                callback.onSuccess(successMap)
            } catch (e: Throwable) {
                callback.onFailure("PIPELINE_ERROR", e.message ?: e.toString(), null)
            }
        }
    }

    // --- Quality Assessment Logic (merged from pipeline) ---

    fun isDocumentPresent(mat: Mat): Boolean {
        val gray = Mat()
        Imgproc.cvtColor(mat, gray, Imgproc.COLOR_BGR2GRAY)

        val blurred = Mat()
        Imgproc.GaussianBlur(gray, blurred, org.opencv.core.Size(5.0, 5.0), 0.0)

        val edges = Mat()
        Imgproc.Canny(blurred, edges, 50.0, 150.0)

        val nonZeroCount = Core.countNonZero(edges)
        val totalPixels = edges.cols() * edges.rows()
        val edgeDensity = nonZeroCount.toDouble() / totalPixels

        val contours = ArrayList<MatOfPoint>()
        val hierarchy = Mat()
        Imgproc.findContours(edges, contours, hierarchy, Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)

        // Clean up allocated Mats
        gray.release()
        blurred.release()
        edges.release()
        hierarchy.release()
        val contoursCount = contours.size
        for (c in contours) {
            c.release()
        }
        val standardEdgeDensityThreshold = 0.003
        val standardContoursCountThreshold = 5

        Log.i(LOG_TAG, "isDocumentPresent: edgeDensity=$edgeDensity, contoursCount=$contoursCount")
        Log.i(
            LOG_TAG,
            "edgeDensity thresholds: $standardEdgeDensityThreshold, contoursCount thresholds: $standardContoursCountThreshold"
        )

        // Standard thresholds: edge density at least 0.3% (0.003) and at least 5 contours
        return edgeDensity >= 0.003 && contoursCount >= 5
    }

    //dùng cho autocapture
    fun computeBlurScore(mat: Mat): Double {
        val gray = Mat()
        Imgproc.cvtColor(mat, gray, Imgproc.COLOR_BGR2GRAY)

        val laplacian = Mat()
        Imgproc.Laplacian(gray, laplacian, CvType.CV_64F)

        val mean = MatOfDouble()
        val stddev = MatOfDouble()
        Core.meanStdDev(laplacian, mean, stddev)

        val stddevVal = stddev.toArray()[0]
        val variance = stddevVal * stddevVal

        gray.release()
        laplacian.release()
        mean.release()
        stddev.release()

        return variance
    }
    //dùng cho autocapture
    fun computeGlarePercent(mat: Mat): Double {
        val gray = Mat()
        Imgproc.cvtColor(mat, gray, Imgproc.COLOR_BGR2GRAY)

        val brightPixelsMat = Mat()
        Imgproc.threshold(gray, brightPixelsMat, 250.0, 255.0, Imgproc.THRESH_BINARY)

        val glarePixelCount = Core.countNonZero(brightPixelsMat)
        val totalPixels = gray.cols() * gray.rows()
        val glarePercent = glarePixelCount.toDouble() / totalPixels

        gray.release()
        brightPixelsMat.release()

        return glarePercent
    }

    // --- Background Tasks ---

    fun deleteLocalImages(paths: List<String>, callback: CleanupCallback) {
        executor.execute {
            try {
                var deleted = 0
                var skipped = 0
                for (raw in paths) {
                    if (raw.isBlank()) {
                        skipped++
                        continue
                    }
                    if (unlinkAllowedPath(raw)) {
                        deleted++
                    } else {
                        skipped++
                    }
                }
                callback.onSuccess(deleted, skipped)
            } catch (e: Throwable) {
                callback.onFailure(e)
            }
        }
    }

    fun scrubCardScannerTempFiles(exclude: List<String>?, callback: CleanupCallback) {
        executor.execute {
            try {
                val excludeSet = HashSet<String>()
                if (exclude != null) {
                    for (raw in exclude) {
                        val norm = normalizeFsPath(raw)
                        if (norm != null) {
                            excludeSet.add(norm)
                        }
                    }
                }
                var deleted = 0
                var skipped = 0
                for (root in allowedTempRoots()) {
                    val files = root.listFiles() ?: continue
                    for (file in files) {
                        if (!file.isFile) {
                            skipped++
                            continue
                        }
                        val name = file.name
                        if (TEMP_FILE_PREFIXES.none { name.startsWith(it) }) {
                            continue
                        }
                        val canon =
                            try {
                                file.canonicalPath
                            } catch (_: Throwable) {
                                skipped++
                                continue
                            }
                        if (excludeSet.contains(canon)) {
                            skipped++
                            continue
                        }
                        if (file.delete()) {
                            deleted++
                        } else {
                            skipped++
                        }
                    }
                }
                callback.onSuccess(deleted, skipped)
            } catch (e: Throwable) {
                callback.onFailure(e)
            }
        }
    }

    fun saveAndCropCardAsync(
        bgrMat: Mat,
        previewWidth: Double,
        previewHeight: Double,
        guideX: Double,
        guideY: Double,
        guideWidth: Double,
        guideHeight: Double,
        bufferOrientation: String,
        blurVal: Double,
        glarePct: Double
    ) {
        executor.execute {
            var uprightMat: Mat? = null
            var croppedMat: Mat? = null

            try {
                uprightMat = normalizeToUprightMat(bgrMat, bufferOrientation)

                val frameW = uprightMat.cols()
                val frameH = uprightMat.rows()

                // Cover mode layout mapping logic
                val scale = maxOf(previewWidth / frameW, previewHeight / frameH)
                val drawnW = frameW * scale
                val drawnH = frameH * scale
                val offX = (previewWidth - drawnW) / 2.0
                val offY = (previewHeight - drawnH) / 2.0

                var rx = (guideX - offX) / scale
                var ry = (guideY - offY) / scale
                var rw = guideWidth / scale
                var rh = guideHeight / scale

                // Outset expansion
                val outset = 0.125
                val wantDx = rw * outset
                val wantDy = rh * outset
                val maxDx = minOf(rx, frameW - rx - rw)
                val maxDy = minOf(ry, frameH - ry - rh)
                val dx = minOf(wantDx, maxDx)
                val dy = minOf(wantDy, maxDy)

                rx -= dx
                ry -= dy
                rw += 2.0 * dx
                rh += 2.0 * dy

                val cropX = Math.round(rx).toInt().coerceIn(0, frameW - 1)
                val cropY = Math.round(ry).toInt().coerceIn(0, frameH - 1)
                val cropW = Math.round(rw).toInt().coerceIn(1, frameW - cropX)
                val cropH = Math.round(rh).toInt().coerceIn(1, frameH - cropY)

                croppedMat = Mat(uprightMat, Rect(cropX, cropY, cropW, cropH))

                val outFile = File(context.cacheDir, "card_scan_${UUID.randomUUID()}.jpg")
                val saved = Imgcodecs.imwrite(outFile.absolutePath, croppedMat)
                if (saved) {
                    eventListener?.onCardCaptured(
                        "file://${outFile.absolutePath}",
                        blurVal,
                        glarePct,
                        cropX,
                        cropY,
                        cropW,
                        cropH
                    )
                } else {
                    eventListener?.onCardCaptureFailed("SAVE_FAILED", "Failed to write cropped JPEG")
                }
            } catch (e: Exception) {
                eventListener?.onCardCaptureFailed("PROCESSING_EXCEPTION", e.message ?: e.toString())
            } finally {
                croppedMat?.release()
                uprightMat?.release()
                bgrMat.release() // CRITICAL: release the copied frame Mat to prevent memory leak!
            }
        }
    }

    // --- Private Helper Methods ---

    private fun expectedUprightSize(photoW: Int, photoH: Int, orientation: String): Pair<Int, Int> =
        when (orientation) {
            "landscape-left", "landscape-right" -> Pair(photoH, photoW)
            else -> Pair(photoW, photoH)
        }

    private fun readExifOrientationTag(path: String): Int? =
        try {
            val exif = ExifInterface(path)
            val v = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_UNDEFINED)
            if (v == ExifInterface.ORIENTATION_UNDEFINED) null else v
        } catch (_: Throwable) {
            null
        }

    private fun normalizeToUprightMat(src: Mat, orientation: String): Mat {
        val out = Mat()
        when (orientation) {
            "portrait" -> src.copyTo(out)
            "landscape-right" -> Core.rotate(src, out, Core.ROTATE_90_CLOCKWISE)
            "landscape-left" -> Core.rotate(src, out, Core.ROTATE_90_COUNTERCLOCKWISE)
            "portrait-upside-down" -> Core.rotate(src, out, Core.ROTATE_180)
            else -> src.copyTo(out)
        }
        return out
    }

    private fun initOpenCv(): Boolean {
        if (openCvReady) return true
        val ok =
            try {
                OpenCVLoader.initLocal()
            } catch (_: Throwable) {
                try {
                    OpenCVLoader.initDebug()
                } catch (_: Throwable) {
                    false
                }
            }
        if (ok) {
            openCvReady = true
        }
        return ok
    }

    private fun stripFileScheme(p: String): String {
        var s = p.trim()
        if (s.startsWith("file://")) {
            s = s.removePrefix("file://")
        }
        return s
    }

    private fun allowedTempRoots(): List<File> {
        return listOfNotNull(context.cacheDir, context.codeCacheDir, context.externalCacheDir)
    }

    private fun normalizeFsPath(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        var p = raw.trim()
        if (p.startsWith("file://")) {
            p = Uri.parse(p).path ?: p.removePrefix("file://")
        }
        return try {
            File(p).canonicalPath
        } catch (_: Throwable) {
            null
        }
    }

    private fun isUnderAllowedRoot(file: File): Boolean {
        val path =
            try {
                file.canonicalPath
            } catch (_: Throwable) {
                return false
            }
        return allowedTempRoots().any { root ->
            val r =
                try {
                    root.canonicalPath
                } catch (_: Throwable) {
                    return@any false
                }
            path == r || path.startsWith(r + File.separator)
        }
    }

    private fun unlinkAllowedPath(raw: String): Boolean {
        val norm = normalizeFsPath(raw) ?: return false
        val file = File(norm)
        if (!file.exists()) return false
        if (!file.isFile) return false
        if (!isUnderAllowedRoot(file)) return false
        return file.delete()
    }
}
