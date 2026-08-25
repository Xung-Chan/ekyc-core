package com.ekyccore.cardscanner

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.util.Log
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
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
import kotlin.getValue
import kotlin.math.max

class CardScannerManager private constructor(private val context: Context) {

    private val executor = Executors.newSingleThreadExecutor()

    @Volatile
    private var openCvReady = false
    private var eventListener: CardScannerEventListener? = null
    private var lastProcessedTimestamp = 0L

    private val recognizer by lazy {
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    }

    @Volatile
    var currentFrameIndex = 0L
        private set

    @Volatile
    var lastOcrExecutionTime = 0L

    private var lastSuccessfulScanTime = 0L
    private var cachedSide: String? = null
    private var cachedFrontScore = 0.0
    private var cachedBackScore = 0.0
    private var cachedImagePath: String? = null
    private var cachedBlurScore = 0.0
    private var cachedGlarePercent = 0.0
    private var cachedAppliedX = 0
    private var cachedAppliedY = 0
    private var cachedAppliedW = 0
    private var cachedAppliedH = 0

    private var lastCorners: Array<org.opencv.core.Point>? = null

    fun incrementFrameIndex() {
        currentFrameIndex++
    }

    fun cacheScanResult(
        imagePath: String,
        side: String,
        frontScore: Double,
        backScore: Double,
        blurScore: Double,
        glarePercent: Double,
        x: Int,
        y: Int,
        w: Int,
        h: Int
    ) {
        lastSuccessfulScanTime = System.currentTimeMillis()
        cachedImagePath = imagePath
        cachedSide = side
        cachedFrontScore = frontScore
        cachedBackScore = backScore
        cachedBlurScore = blurScore
        cachedGlarePercent = glarePercent
        cachedAppliedX = x
        cachedAppliedY = y
        cachedAppliedW = w
        cachedAppliedH = h
    }

    fun hasValidCachedResult(maxAgeMs: Long): Boolean {
        val path = cachedImagePath
        if (path.isNullOrBlank()) return false
        val age = System.currentTimeMillis() - lastSuccessfulScanTime
        return age in 0..maxAgeMs
    }

    fun getCachedResultMap(): Map<String, Any>? {
        val path = cachedImagePath ?: return null
        return mapOf(
            "croppedImagePath" to path,
            "side" to (cachedSide ?: "unknown"),
            "sideFrontScore" to cachedFrontScore,
            "sideBackScore" to cachedBackScore,
            "blurScore" to cachedBlurScore,
            "glarePercent" to cachedGlarePercent,
            "appliedX" to cachedAppliedX,
            "appliedY" to cachedAppliedY,
            "appliedW" to cachedAppliedW,
            "appliedH" to cachedAppliedH
        )
    }

    fun clearCache() {
        cachedImagePath = null
        cachedSide = null
        cachedFrontScore = 0.0
        cachedBackScore = 0.0
    }

    fun clearCorners() {
        lastCorners = null
    }

    fun detectCardCorners(mat: Mat): Array<org.opencv.core.Point>? {
        val gray = Mat()
        Imgproc.cvtColor(mat, gray, Imgproc.COLOR_BGR2GRAY)
        val blurred = Mat()
        Imgproc.GaussianBlur(gray, blurred, org.opencv.core.Size(5.0, 5.0), 0.0)
        val edges = Mat()
        Imgproc.Canny(blurred, edges, 50.0, 150.0)

        val contours = ArrayList<MatOfPoint>()
        val hierarchy = Mat()
        Imgproc.findContours(edges, contours, hierarchy, Imgproc.RETR_EXTERNAL, Imgproc.CHAIN_APPROX_SIMPLE)

        var maxArea = 0.0
        var bestContour: MatOfPoint? = null
        for (c in contours) {
            val area = Imgproc.contourArea(c)
            if (area > maxArea) {
                maxArea = area
                bestContour = c
            }
        }

        var corners: Array<org.opencv.core.Point>? = null
        if (bestContour != null && maxArea > (mat.cols() * mat.rows() * 0.10)) {
            val mop2f = org.opencv.core.MatOfPoint2f(*bestContour.toArray())
            
            // 1. Dùng RotatedRect (minAreaRect) để lấy khung bao hình chữ nhật xoay tối ưu (luôn có 4 đỉnh)
            val minRect = Imgproc.minAreaRect(mop2f)
            val rectWidth = minRect.size.width
            val rectHeight = minRect.size.height
            val longSide = maxOf(rectWidth, rectHeight)
            val shortSide = minOf(rectWidth, rectHeight)

            if (shortSide > 0) {
                val aspectRatio = longSide / shortSide
                // Tỷ lệ chuẩn của thẻ ID card là ~1.586. Cho phép khoảng sai số rộng [1.2, 2.1] để bù trừ góc nghiêng phối cảnh
                val isCardAspectRatio = aspectRatio in 1.2..2.1
                
                // 3. Tính độ lấp đầy (Solidity / Rectangularity) để loại bỏ nhiễu ngẫu nhiên không phải hình hộp
                val rectArea = rectWidth * rectHeight
                val rectangularity = if (rectArea > 0) maxArea / rectArea else 0.0
                
                // Độ lấp đầy đối với thẻ ID thật thường >= 0.70 (do bo góc tròn và ngón tay che nhẹ)
                val isRectangularEnough = rectangularity >= 0.70
                
                if (isCardAspectRatio && isRectangularEnough) {
                    val pts = Array(4) { org.opencv.core.Point() }
                    minRect.points(pts)
                    corners = pts
                } else {
                    Log.d(LOG_TAG, "detectCardCorners: failed criteria: aspect=$aspectRatio (ok=$isCardAspectRatio), rectangularity=$rectangularity (ok=$isRectangularEnough)")
                }
            }
            mop2f.release()
        }

        gray.release()
        blurred.release()
        edges.release()
        hierarchy.release()
        for (c in contours) {
            c.release()
        }
        return corners
    }

    fun calculateCornerDrift(current: Array<org.opencv.core.Point>, last: Array<org.opencv.core.Point>, width: Double): Double {
        if (current.size != 4 || last.size != 4) return 1.0
        val sortedCurrent = sortCorners(current)
        val sortedLast = sortCorners(last)

        var maxDrift = 0.0
        for (i in 0 until 4) {
            val dx = sortedCurrent[i].x - sortedLast[i].x
            val dy = sortedCurrent[i].y - sortedLast[i].y
            val dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > maxDrift) {
                maxDrift = dist
            }
        }
        return maxDrift / width
    }

    private fun sortCorners(pts: Array<org.opencv.core.Point>): Array<org.opencv.core.Point> {
        val sorted = Array(4) { org.opencv.core.Point() }
        sorted[0] = pts.minByOrNull { it.x + it.y } ?: pts[0]
        sorted[2] = pts.maxByOrNull { it.x + it.y } ?: pts[2]
        sorted[1] = pts.minByOrNull { it.y - it.x } ?: pts[1]
        sorted[3] = pts.maxByOrNull { it.y - it.x } ?: pts[3]
        return sorted
    }

    fun checkCardStability(mat: Mat): Boolean {
        val current = detectCardCorners(mat)
        val last = lastCorners

        var stable = false
        if (current != null && last != null) {
            val drift = calculateCornerDrift(current, last, mat.cols().toDouble())
            stable = drift < 0.10
        }

        if (current != null) {
            lastCorners = current
        }
        return stable
    }

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
        val side: String? = null,
        val sideFrontScore: Double? = null,
        val sideBackScore: Double? = null,
        val blurScore: Double? = null,
        val glarePercent: Double? = null,
    )

    interface CardScannerEventListener {
        fun onCardCaptured(
            croppedImagePath: String,
            blurScore: Double,
            glarePercent: Double,
            appliedX: Int,
            appliedY: Int,
            appliedWidth: Int,
            appliedHeight: Int,
            side: String,
            sideFrontScore: Double,
            sideBackScore: Double
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
        expectedSide: String? = null,
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
                    errorCode = "NO_CARD_QUAD",
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

            val qualityError = validateQuality(cloned)
            if (qualityError != null) {
                val errorMsg = when (qualityError) {
                    "IMAGE_TOO_BLURRY" -> "Hình ảnh bị mờ nhòe, vui lòng giữ yên thiết bị"
                    "IMAGE_HAS_MOTION_BLUR" -> "Hình ảnh bị nhòe do chuyển động, vui lòng chụp lại"
                    "IMAGE_TOO_DARK" -> "Hình ảnh quá tối, vui lòng chụp ở nơi đủ sáng"
                    "IMAGE_TOO_BRIGHT" -> "Hình ảnh quá sáng, vui lòng điều chỉnh ánh sáng"
                    "IMAGE_LOW_CONTRAST" -> "Độ tương phản thấp, vui lòng đặt thẻ trên nền tương phản"
                    "IMAGE_HAS_GLARE" -> "Hình ảnh bị lóa sáng, vui lòng điều chỉnh góc chụp"
                    else -> "Chất lượng hình ảnh không đạt yêu cầu"
                }
                return CropJpegOnlyResult(
                    success = false,
                    croppedAbsolutePath = null,
                    appliedX = x,
                    appliedY = y,
                    appliedW = w,
                    appliedH = h,
                    errorCode = qualityError,
                    errorMessage = errorMsg,
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

            val ocrRes = runOcrAndSideClassification(cloned, expectedSide)
            if (!ocrRes.success) {
                return CropJpegOnlyResult(
                    success = false,
                    croppedAbsolutePath = null,
                    appliedX = x,
                    appliedY = y,
                    appliedW = w,
                    appliedH = h,
                    errorCode = ocrRes.errorCode ?: "OCR_FAILED",
                    errorMessage = ocrRes.errorMessage ?: "OCR validation failed",
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

            val finalBlur = computeBlurScore(cloned)
            val finalGlare = computeGlarePercent(cloned)

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
                side = ocrRes.side,
                sideFrontScore = ocrRes.frontScore,
                sideBackScore = ocrRes.backScore,
                blurScore = finalBlur,
                glarePercent = finalGlare
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
        expectedSide: String?,
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
                        expectedSide,
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

                val successMap = mutableMapOf<String, Any>(
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
                ).apply {
                    r.side?.let { put("side", it) }
                    r.sideFrontScore?.let { put("sideFrontScore", it) }
                    r.sideBackScore?.let { put("sideBackScore", it) }
                    r.blurScore?.let { put("blurScore", it) }
                    r.glarePercent?.let { put("glarePercent", it) }
                }

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

        gray.release()
        blurred.release()
        edges.release()

        if (edgeDensity < 0.003) {
            return false
        }

        val corners = detectCardCorners(mat)
        if (corners == null || corners.size != 4) {
            Log.i(LOG_TAG, "isDocumentPresent: failed because detected corners is not 4")
            return false
        }

        // Nới lỏng biên kiểm định sang biên âm (ngoài vùng crop) tối đa 15 pixel
        // giúp tránh lỗi khi MinAreaRect hơi mở rộng ra ngoài một chút do bo tròn góc hoặc nhiễu viền
        val marginX = -15.0
        val marginY = -15.0
        val W = mat.cols().toDouble()
        val H = mat.rows().toDouble()
        for (pt in corners) {
            if (pt.x <= marginX || pt.x >= (W - marginX) || pt.y <= marginY || pt.y >= (H - marginY)) {
                Log.i(LOG_TAG, "isDocumentPresent: failed because corner is clipped by margin: x=${pt.x}, y=${pt.y}, W=$W, H=$H")
                return false
            }
        }

        Log.i(LOG_TAG, "isDocumentPresent: PASSED! Corners detected and fully within crop region.")
        return true
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
        glarePct: Double,
        expectedSide: String?,
        frameIndex: Long
    ) {
        executor.execute {
            Log.i("EkycCardScanner", "saveAndCropCardAsync task started for frame $frameIndex")
            var uprightMat: Mat? = null
            var croppedMat: Mat? = null

            try {
                val gap = currentFrameIndex - frameIndex
                if (gap > 8) {
                    Log.w("EkycCardScanner", "Stale Async Drop: frame index gap is $gap (max 8). Dropping.")
                    eventListener?.onCardCaptureFailed("STALE_FRAME", "Frame processing took too long")
                    return@execute
                }

                uprightMat = normalizeToUprightMat(bgrMat, bufferOrientation)
                if (uprightMat.empty()) {
                    eventListener?.onCardCaptureFailed("PROCESSING_EXCEPTION", "Input image buffer is empty")
                    return@execute
                }

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

                val cropX = Math.round(rx).toInt().coerceIn(0, max(0, frameW - 1))
                val cropY = Math.round(ry).toInt().coerceIn(0, max(0, frameH - 1))
                val cropW = Math.round(rw).toInt().coerceIn(1, max(1, frameW - cropX))
                val cropH = Math.round(rh).toInt().coerceIn(1, max(1, frameH - cropY))

                croppedMat = Mat(uprightMat, Rect(cropX, cropY, cropW, cropH))

                val qualityError = validateQuality(croppedMat)
                if (qualityError != null) {
                    Log.w("EkycCardScanner", "validateQuality failed: $qualityError")
                    val errorMsg = when (qualityError) {
                        "IMAGE_TOO_BLURRY" -> "Hình ảnh bị mờ nhòe, vui lòng giữ yên thiết bị"
                        "IMAGE_HAS_MOTION_BLUR" -> "Hình ảnh bị nhòe do chuyển động, vui lòng chụp lại"
                        "IMAGE_TOO_DARK" -> "Hình ảnh quá tối, vui lòng chụp ở nơi đủ sáng"
                        "IMAGE_TOO_BRIGHT" -> "Hình ảnh quá sáng, vui lòng điều chỉnh ánh sáng"
                        "IMAGE_LOW_CONTRAST" -> "Độ tương phản thấp, vui lòng đặt thẻ trên nền tương phản"
                        "IMAGE_HAS_GLARE" -> "Hình ảnh bị lóa sáng, vui lòng điều chỉnh góc chụp"
                        else -> "Chất lượng hình ảnh không đạt yêu cầu"
                    }
                    eventListener?.onCardCaptureFailed(qualityError, errorMsg)
                    return@execute
                }

                val ocrRes = runOcrAndSideClassification(croppedMat, expectedSide)
                if (!ocrRes.success) {
                    Log.w("EkycCardScanner", "OCR Side Classification failed: code=${ocrRes.errorCode}, message=${ocrRes.errorMessage}")
                    eventListener?.onCardCaptureFailed(
                        ocrRes.errorCode ?: "OCR_FAILED",
                        ocrRes.errorMessage ?: "OCR validation failed"
                    )
                    return@execute
                }

                val outFile = File(context.cacheDir, "card_scan_${UUID.randomUUID()}.jpg")
                val saved = Imgcodecs.imwrite(outFile.absolutePath, croppedMat)
                if (saved) {
                    Log.i("EkycCardScanner", "saveAndCropCardAsync succeeded! Cached and Emitting success event.")
                    cacheScanResult(
                        "file://${outFile.absolutePath}",
                        ocrRes.side,
                        ocrRes.frontScore,
                        ocrRes.backScore,
                        blurVal,
                        glarePct,
                        cropX,
                        cropY,
                        cropW,
                        cropH
                    )
                    eventListener?.onCardCaptured(
                        "file://${outFile.absolutePath}",
                        blurVal,
                        glarePct,
                        cropX,
                        cropY,
                        cropW,
                        cropH,
                        ocrRes.side,
                        ocrRes.frontScore,
                        ocrRes.backScore
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

    data class OcrResult(
        val success: Boolean,
        val side: String,
        val frontScore: Double,
        val backScore: Double,
        val errorCode: String?,
        val errorMessage: String?
    )

    fun runOcrAndSideClassification(mat: Mat, expectedSide: String?): OcrResult {
        val bmp = try {
            val b = Bitmap.createBitmap(mat.cols(), mat.rows(), Bitmap.Config.ARGB_8888)
            org.opencv.android.Utils.matToBitmap(mat, b)
            b
        } catch (e: Exception) {
            return OcrResult(false, "unknown", 0.0, 0.0, "OCR_FAILED", "Failed to convert OpenCV Mat to Bitmap: ${e.message}")
        }

        val image = InputImage.fromBitmap(bmp, 0)
        return try {
            val task = recognizer.process(image)
            val resultText = Tasks.await(task)
            val fullText = resultText.text
            if (fullText.isNullOrBlank()) {
                OcrResult(false, "unknown", 0.0, 0.0, "OCR_FAILED", "Không thể nhận diện được chữ trên thẻ")
            } else {
                val normalized = normalizeText(fullText)
                var frontScore = 0.0
                var backScore = 0.0

                val frontKeywords = listOf(
                    "CAN CUOC", "CAN CUOC CONG DAN", "HO VA TEN", "NGAY SINH", "QUOC TICH", "GIOI TINH",
                    "SO CC", "SO CCCD", "CCCD", "CONG HOA XA HOI CHU NGHIA VIET NAM", "DOC LAP TU DO HANH PHUC",
                    "SO DINH DANH CA NHAN", "HO CHU DEM VA TEN KHAI SINH", "NGAY THANG NAM SINH",
                    "CO GIA TRI DEN", "IDENTITY CARD", "CITIZEN IDENTITY CARD", "QUE QUAN", "NOI THUONG TRU"
                )

                val backKeywords = listOf(
                    "DAC DIEM NHAN DANG", "NOI CU TRU", "NGAY CAP", "NOI DKKTT", "IDVNM", "BO CONG AN",
                    "MINISTRY OF PUBLIC SECURITY", "NOI DANG KY KHAI SINH", "PLACE OF BIRTH REGISTRATION",
                    "PLACE OF RESIDENCE", "NGON TRO TRAI", "NGON TRO PHAI", "LEFT INDEX FINGER", "RIGHT INDEX FINGER",
                    "CUC TRUONG CUC CANH SAT", "PERSONAL IDENTIFICATION"
                )

                for (kw in frontKeywords) {
                    if (normalized.contains(kw)) {
                        frontScore += 1.0
                    }
                }

                for (kw in backKeywords) {
                    if (normalized.contains(kw)) {
                        backScore += 1.0
                    }
                }

                val actualSide = if (frontScore == 0.0 && backScore == 0.0) {
                    "unknown"
                } else if (frontScore > backScore) {
                    "front"
                } else if (backScore > frontScore) {
                    "back"
                } else {
                    "unknown"
                }

                if (expectedSide != null && expectedSide != "unknown" && actualSide != "unknown") {
                    if (expectedSide == "front" && actualSide == "back") {
                        OcrResult(false, actualSide, frontScore, backScore, "EXPECTED_FRONT_BUT_GOT_BACK", "Thẻ được quét là mặt sau, vui lòng quét mặt trước")
                    } else if (expectedSide == "back" && actualSide == "front") {
                        OcrResult(false, actualSide, frontScore, backScore, "EXPECTED_BACK_BUT_GOT_FRONT", "Thẻ được quét là mặt trước, vui lòng quét mặt sau")
                    } else {
                        OcrResult(true, actualSide, frontScore, backScore, null, null)
                    }
                } else if (actualSide == "unknown") {
                    OcrResult(false, actualSide, frontScore, backScore, "OCR_FAILED", "Không thể xác định mặt thẻ (mờ hoặc sai giấy tờ)")
                } else {
                    OcrResult(true, actualSide, frontScore, backScore, null, null)
                }
            }
        } catch (e: Exception) {
            OcrResult(false, "unknown", 0.0, 0.0, "OCR_FAILED", "OCR process error: ${e.message}")
        } finally {
            bmp.recycle()
        }
    }

    private fun normalizeText(text: String): String {
        val temp = java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFD)
        val pattern = java.util.regex.Pattern.compile("\\p{InCombiningDiacriticalMarks}+")
        return pattern.matcher(temp).replaceAll("").uppercase()
    }

    fun validateQuality(mat: Mat): String? {
        val gray = Mat()
        Imgproc.cvtColor(mat, gray, Imgproc.COLOR_BGR2GRAY)

        val mean = MatOfDouble()
        val stddev = MatOfDouble()
        Core.meanStdDev(gray, mean, stddev)
        val meanVal = mean.toArray()[0]
        val stddevVal = stddev.toArray()[0]

        if (meanVal < 58.0) {
            gray.release()
            mean.release()
            stddev.release()
            return "IMAGE_TOO_DARK"
        }
        if (meanVal > 220.0) {
            gray.release()
            mean.release()
            stddev.release()
            return "IMAGE_TOO_BRIGHT"
        }
        if (stddevVal < 12.0) {
            gray.release()
            mean.release()
            stddev.release()
            return "IMAGE_LOW_CONTRAST"
        }

        val laplacian = Mat()
        Imgproc.Laplacian(gray, laplacian, CvType.CV_64F)
        val lapMean = MatOfDouble()
        val lapStddev = MatOfDouble()
        Core.meanStdDev(laplacian, lapMean, lapStddev)
        val lapStdVal = lapStddev.toArray()[0]
        val blurVariance = lapStdVal * lapStdVal

        laplacian.release()
        lapMean.release()
        lapStddev.release()

        if (blurVariance < 80.0) {
            gray.release()
            mean.release()
            stddev.release()
            return "IMAGE_TOO_BLURRY"
        }

        val sobelX = Mat()
        val sobelY = Mat()
        Imgproc.Sobel(gray, sobelX, CvType.CV_32F, 1, 0)
        Imgproc.Sobel(gray, sobelY, CvType.CV_32F, 0, 1)
        val absX = Mat()
        val absY = Mat()
        Core.absdiff(sobelX, Mat.zeros(sobelX.size(), sobelX.type()), absX)
        Core.absdiff(sobelY, Mat.zeros(sobelY.size(), sobelY.type()), absY)
        val sumX = Core.sumElems(absX).`val`[0]
        val sumY = Core.sumElems(absY).`val`[0]

        sobelX.release()
        sobelY.release()
        absX.release()
        absY.release()

        val motionScore = if (sumX + sumY > 0) Math.abs(sumX - sumY) / (sumX + sumY) else 0.0
        if (motionScore > 0.82 && blurVariance < 124.0) {
            gray.release()
            mean.release()
            stddev.release()
            return "IMAGE_HAS_MOTION_BLUR"
        }

        gray.release()
        mean.release()
        stddev.release()

        val hsv = Mat()
        Imgproc.cvtColor(mat, hsv, Imgproc.COLOR_BGR2HSV)
        val channels = ArrayList<Mat>()
        Core.split(hsv, channels)
        val s = channels[1]
        val v = channels[2]

        val maskS = Mat()
        val maskV = Mat()
        Imgproc.threshold(s, maskS, 42.0, 255.0, Imgproc.THRESH_BINARY_INV)
        Imgproc.threshold(v, maskV, 247.0, 255.0, Imgproc.THRESH_BINARY)

        val glareMask = Mat()
        Core.bitwise_and(maskS, maskV, glareMask)

        val labels = Mat()
        val stats = Mat()
        val centroids = Mat()
        val numComponents = Imgproc.connectedComponentsWithStats(glareMask, labels, stats, centroids)

        var maxGlareArea = 0
        val totalPixels = mat.cols() * mat.rows()
        for (i in 1 until numComponents) {
            val area = stats.get(i, Imgproc.CC_STAT_AREA)[0].toInt()
            if (area > maxGlareArea) {
                maxGlareArea = area
            }
        }

        hsv.release()
        glareMask.release()
        maskS.release()
        maskV.release()
        labels.release()
        stats.release()
        centroids.release()
        for (c in channels) {
            c.release()
        }

        val glarePercent = maxGlareArea.toDouble() / totalPixels
        if (glarePercent >= 0.035) {
            return "IMAGE_HAS_GLARE"
        }

        return null
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
