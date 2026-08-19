package com.faceportrait.scanner

import android.content.Context
import android.util.Log
import androidx.exifinterface.media.ExifInterface
import org.opencv.android.OpenCVLoader
import org.opencv.core.Core
import org.opencv.core.Mat
import org.opencv.core.Rect
import org.opencv.imgcodecs.Imgcodecs
import java.io.File
import java.util.UUID
import kotlin.math.max

private const val LOG_MANUAL_CROP = "EkycCardScanner"

class CardScannerPipeline(context: Context) {

  private val appContext = context.applicationContext

  @Volatile
  private var openCvReady = false

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
      LOG_MANUAL_CROP,
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
          LOG_MANUAL_CROP,
          "upright beforeRotate=${decW}x${decH} exif=${exifTag ?: "none"} " +
            "sourcePhoto=${sourcePhotoWidth}x${sourcePhotoHeight} expectedUpright=${expW}x${expH} " +
            "cropRect=($cropX,$cropY ${cropW}x${cropH}) bufferOrient=$bufferOrientation",
        )
        work =
          when {
            decW == expW && decH == expH -> {
              skippedUprightRotate = true
              Log.i(
                LOG_MANUAL_CROP,
                "upright skipRotate=true (decoded already matches JS upright; no double-EXIF rotate)",
              )
              Mat().also { original.copyTo(it) }
            }
            decW == sourcePhotoWidth && decH == sourcePhotoHeight -> {
              Log.i(LOG_MANUAL_CROP, "upright rotate from PhotoFile raw buffer dimensions")
              normalizeToUprightMat(original, bufferOrientation!!)
            }
            else -> {
              Log.w(
                LOG_MANUAL_CROP,
                "imread ${decW}x${decH} differs from sourcePhoto ${sourcePhotoWidth}x${sourcePhotoHeight}; " +
                  "normalizeToUpright from decoded buffer",
              )
              normalizeToUprightMat(original, bufferOrientation!!)
            }
          }
        original.release()
        val bw = work!!.cols()
        val bh = work!!.rows()
        if (bw != expW || bh != expH) {
          work!!.release()
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
          LOG_MANUAL_CROP,
          "upright assert ok bitmap=${bw}x${bh} == expectedUpright skipRotate=$skippedUprightRotate finalCropSpace=upright",
        )
        base = work!!
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
          LOG_MANUAL_CROP,
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
        LOG_MANUAL_CROP,
        "crop applied on bitmap ${W}x${H} rect=($x,$y ${w}x${h})",
      )
      sub = Mat(base, Rect(x, y, w, h))
      cloned = sub.clone()
      val outFile = File(appContext.cacheDir, "card_manual_crop_${UUID.randomUUID()}.jpg")
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
      else -> {
        Log.w(LOG_MANUAL_CROP, "unknown bufferOrientation=$orientation, copy as-is")
        src.copyTo(out)
      }
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
}
