package com.faceportrait

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.RectF
import android.media.ExifInterface
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.pow

internal data class FacePortraitPreviewResult(
  val textCode: String,
  val detail: String?,
  /** Normalized top-left in buffer space [0,1]. */
  val faceRectNorm: RectF?,
  val meanLuma: Float?,
  val fillRatio: Float?,
)

internal object FacePortraitBgrAnalyzer {
  private const val TAG = "FacePortraitBgr"
  /** Điều kiện ellipse cho tâm mặt (`off_center`). */
  private const val GUIDE_ELLIPSE_NORM_MAX_CENTER = 1.08f

  private val detectorPreview: FaceDetector by lazy {
    val opts =
      FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
        .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
        .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
        .build()
    FaceDetection.getClient(opts)
  }

  private val detectorAccurate: FaceDetector by lazy {
    val opts =
      FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
        .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
        .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
        .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
        .build()
    FaceDetection.getClient(opts)
  }

  fun previewFromBgr(w: Int, h: Int, bgr: ByteArray, config: FacePortraitConfig): FacePortraitPreviewResult {
    if (w <= 0 || h <= 0 || bgr.size != w * h * 3) {
      return FacePortraitPreviewResult("searching", "invalid_buffer", null, null, null)
    }
    val bitmap = bgrToBitmap(w, h, bgr)
    return try {
      val input = InputImage.fromBitmap(bitmap, 0)
      val faces = Tasks.await(detectorPreview.process(input))
      val face = pickPrimaryFace(faces)
      if (face == null) {
        FacePortraitPreviewResult("no_face", "no_face_detected", null, null, null)
      } else {
        val luma = meanLumaBgrInRect(bgr, w, h, face.boundingBox)
        evaluate(face, w.toFloat(), h.toFloat(), luma, config)
      }
    } catch (e: Exception) {
      Log.w(TAG, "preview detect failed", e)
      FacePortraitPreviewResult("searching", "face_detection_failed", null, null, null)
    } finally {
      bitmap.recycle()
    }
  }

  /**
   * Ảnh JPEG full: mặc định xác nhận có khuôn mặt (không tạo file crop).
   * [verifyFaceOnStill] = false: chỉ cần decode JPEG được (tin preview).
   */
  fun finalizeFromJpegPath(
    absoluteJpegPath: String,
    verifyFaceOnStill: Boolean = true,
  ): Pair<Boolean, String?> {
    val oriented = loadOrientedBitmap(absoluteJpegPath) ?: return false to "decode_full_failed"
    if (!verifyFaceOnStill) {
      oriented.recycle()
      return true to null
    }
    return try {
      val input = InputImage.fromBitmap(oriented, 0)
      val faces = Tasks.await(detectorAccurate.process(input))
      val face = pickPrimaryFace(faces)
      if (face == null) {
        return false to "no_face_on_still"
      }
      true to null
    } catch (e: Exception) {
      Log.e(TAG, "finalize failed", e)
      false to (e.message ?: "finalize_failed")
    } finally {
      oriented.recycle()
    }
  }

  private fun pickPrimaryFace(faces: List<Face>): Face? =
    faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }

  private fun faceBoundingBoxInsideGuide(
    face: RectF,
    guide: RectF,
    padFrac: Float,
  ): Boolean {
    val p = padFrac.coerceIn(0f, 0.25f)
    val padX = guide.width() * p
    val padY = guide.height() * p
    return face.left >= guide.left - padX &&
      face.top >= guide.top - padY &&
      face.right <= guide.right + padX &&
      face.bottom <= guide.bottom + padY
  }

  private fun guideRectPixels(vw: Float, vh: Float, c: FacePortraitConfig): RectF {
    val gw = vw * c.guideWidthFraction.toFloat()
    val gh = (gw / c.guideAspectRatio).toFloat()
    val cx = vw / 2f
    val cy = vh * c.guideCenterYFraction.toFloat()
    return RectF(cx - gw / 2f, cy - gh / 2f, cx + gw / 2f, cy + gh / 2f)
  }

  private fun faceRectPixels(face: Face, frameW: Float, frameH: Float): RectF {
    val b = face.boundingBox
    return RectF(
      b.left.toFloat(),
      b.top.toFloat(),
      b.right.toFloat(),
      b.bottom.toFloat(),
    ).let { r ->
      // clamp
      RectF(
        r.left.coerceIn(0f, frameW),
        r.top.coerceIn(0f, frameH),
        r.right.coerceIn(0f, frameW),
        r.bottom.coerceIn(0f, frameH),
      )
    }
  }

  private fun evaluate(
    face: Face,
    frameW: Float,
    frameH: Float,
    meanLuma: Float,
    config: FacePortraitConfig,
  ): FacePortraitPreviewResult {
    val guide = guideRectPixels(frameW, frameH, config)
    val facePx = faceRectPixels(face, frameW, frameH)

    val nx = facePx.left / frameW
    val ny = facePx.top / frameH
    val nw = (facePx.width() / frameW).coerceAtLeast(1e-4f)
    val nh = (facePx.height() / frameH).coerceAtLeast(1e-4f)
    val norm = RectF(nx, ny, nx + nw, ny + nh)

    if (meanLuma >= config.glareMeanLumaThreshold) {
      return FacePortraitPreviewResult("glare", "bright_spot_or_glare", norm, meanLuma, null)
    }

    if (abs(face.headEulerAngleZ) > config.maxAbsRollDeg ||
      abs(face.headEulerAngleY) > config.maxAbsYawDeg ||
      abs(face.headEulerAngleX) > config.maxAbsPitchDeg
    ) {
      return FacePortraitPreviewResult("tilted", "face_angle_out_of_range", norm, meanLuma, null)
    }

    val fx = facePx.centerX()
    val fy = facePx.centerY()
    val gcX = guide.centerX()
    val gcY = guide.centerY()
    val rx = guide.width() / 2f
    val ry = guide.height() / 2f
    if (rx > 0 && ry > 0) {
      val ellNorm = (fx - gcX).pow(2) / rx.pow(2) + (fy - gcY).pow(2) / ry.pow(2)
      if (ellNorm > GUIDE_ELLIPSE_NORM_MAX_CENTER) {
        return FacePortraitPreviewResult("off_center", "face_not_centered_in_guide", norm, meanLuma, null)
      }
    }
    if (!faceBoundingBoxInsideGuide(
        facePx,
        guide,
        config.guideFaceContainmentPaddingFraction,
      )
    ) {
      return FacePortraitPreviewResult("not_in_frame", "align_face_in_guide", norm, meanLuma, null)
    }

    val fh = facePx.height()
    val gh = guide.height()
    val gw = guide.width()
    val fillH = if (gh > 0f) fh / gh else 0f
    val fillW = if (gw > 0f) facePx.width() / gw else 0f
    /** Cao và ngang đều lớn mới coi là quá gần — tránh báo oan mặt cao nhưng hẹp trong oval. */
    val fillClose = minOf(fillH, fillW)
    val fill = fillH

    if (fillH < config.faceTargetFillMin.toFloat()) {
      return FacePortraitPreviewResult("too_far", "move_closer", norm, meanLuma, fill)
    }
    if (fillClose > config.faceTargetFillMax.toFloat()) {
      return FacePortraitPreviewResult("too_close", "move_farther", norm, meanLuma, fill)
    }

    if (!eyesOpenAcceptable(face, config)) {
      return FacePortraitPreviewResult("eyes_closed", null, norm, meanLuma, fill)
    }

    return FacePortraitPreviewResult("ready", null, norm, meanLuma, fill)
  }

  /**
   * Chỉ chặn khi ML Kit trả đủ xác suất; [Face.UNCOMPUTED_PROBABILITY] = không kiểm tra phía đó (lenient).
   */
  private fun eyesOpenAcceptable(face: Face, config: FacePortraitConfig): Boolean {
    if (!config.requireEyesOpen) return true
    val minP = config.eyeOpenProbabilityMin
    val l = face.leftEyeOpenProbability
    val r = face.rightEyeOpenProbability
    val lUnset = l == null || l < 0f
    val rUnset = r == null || r < 0f
    if (lUnset && rUnset) return true
    if (l != null && l >= 0f && l < minP) return false
    if (r != null && r >= 0f && r < minP) return false
    return true
  }

  private fun bgrToBitmap(w: Int, h: Int, bgr: ByteArray): Bitmap {
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val pixels = IntArray(w * h)
    var i = 0
    for (p in 0 until w * h) {
      val b = bgr[i].toInt() and 0xff
      val g = bgr[i + 1].toInt() and 0xff
      val r = bgr[i + 2].toInt() and 0xff
      i += 3
      pixels[p] = -0x1000000 or (r shl 16) or (g shl 8) or b
    }
    bmp.setPixels(pixels, 0, w, 0, 0, w, h)
    return bmp
  }

  private fun meanLumaBgrInRect(bgr: ByteArray, w: Int, h: Int, bbox: Rect): Float {
    val left = bbox.left.coerceIn(0, w - 1)
    val top = bbox.top.coerceIn(0, h - 1)
    val right = bbox.right.coerceIn(1, w)
    val bottom = bbox.bottom.coerceIn(1, h)
    var sum = 0L
    var n = 0
    var y = top
    while (y < bottom) {
      var x = left
      while (x < right) {
        val idx = (y * w + x) * 3
        if (idx + 2 < bgr.size) {
          val b = bgr[idx].toInt() and 0xff
          val g = bgr[idx + 1].toInt() and 0xff
          val r = bgr[idx + 2].toInt() and 0xff
          sum += (r + g + b) / 3
          n++
        }
        x += 4
      }
      y += 4
    }
    return if (n == 0) 0f else sum.toFloat() / n
  }

  private fun loadOrientedBitmap(path: String): Bitmap? {
    val raw = BitmapFactory.decodeFile(path) ?: return null
    return try {
      val ex = ExifInterface(path)
      val orientation =
        ex.getAttributeInt(
          ExifInterface.TAG_ORIENTATION,
          ExifInterface.ORIENTATION_NORMAL,
        )
      val matrix = Matrix()
      when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
        ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
        ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
        else -> {}
      }
      if (matrix.isIdentity) {
        raw
      } else {
        val r = Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, matrix, true)
        raw.recycle()
        r
      }
    } catch (_: Exception) {
      raw
    }
  }

  /** Encode BGR buffer → JPEG (dùng lưu gallery / debug). */
  fun bgrToJpegBytes(w: Int, h: Int, bgr: ByteArray, quality: Int = 88): ByteArray? {
    if (w <= 0 || h <= 0 || bgr.size != w * h * 3) return null
    val bmp = bgrToBitmap(w, h, bgr)
    return try {
      ByteArrayOutputStream().use { os ->
        if (!bmp.compress(Bitmap.CompressFormat.JPEG, quality, os)) null
        else os.toByteArray()
      }
    } finally {
      bmp.recycle()
    }
  }

  /** Ghi đè `cacheDir/ekyc_face_debug/last_preview.jpg` — ảnh đúng buffer gửi ML Kit (debug). */
  fun writeLastDebugPreviewJpeg(cacheDir: File, w: Int, h: Int, bgr: ByteArray): String? {
    if (w <= 0 || h <= 0 || bgr.size != w * h * 3) return null
    val dir = File(cacheDir, "ekyc_face_debug").apply { mkdirs() }
    val file = File(dir, "last_preview.jpg")
    val bmp = bgrToBitmap(w, h, bgr)
    return try {
      FileOutputStream(file).use { os ->
        if (bmp.compress(Bitmap.CompressFormat.JPEG, 88, os)) {
          "file://${file.absolutePath}"
        } else {
          null
        }
      }
    } catch (_: Exception) {
      null
    } finally {
      bmp.recycle()
    }
  }
}
