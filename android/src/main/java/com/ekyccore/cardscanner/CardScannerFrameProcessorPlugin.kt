package com.ekyccore.cardscanner

import android.graphics.ImageFormat
import android.media.Image
import com.mrousavy.camera.core.FrameInvalidError
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import org.opencv.android.OpenCVLoader
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.imgproc.Imgproc

class CardScannerFrameProcessorPlugin(
  private val proxy: VisionCameraProxy,
  options: Map<String, Any>?
) : FrameProcessorPlugin() {

  private var lastProcessedTimestamp = 0L
  private var openCvReady = false

  init {
    initOpenCv()
  }

  override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
    if (!initOpenCv() || arguments == null) {
      return null
    }

    // Synchronous throttle check to avoid converting frames unnecessarily
    val now = System.currentTimeMillis()
    val throttleMs = (arguments["throttleMs"] as? Number)?.toLong() ?: 200L
    if (now - lastProcessedTimestamp < throttleMs) {
      return null
    }

    val image: Image
    try {
      image = frame.image
    } catch (e: FrameInvalidError) {
      return null
    } catch (e: Exception) {
      return null
    }

    // Convert YUV Image to BGR Mat synchronously on the camera thread to copy the buffer
    val bgrMat = try {
      yuvToBgr(image)
    } catch (e: Exception) {
      return null
    }

    lastProcessedTimestamp = now

    // Extract layout guidelines and quality parameters
    val previewWidth = (arguments["previewWidth"] as? Number)?.toDouble() ?: 0.0
    val previewHeight = (arguments["previewHeight"] as? Number)?.toDouble() ?: 0.0
    val guideX = (arguments["guideX"] as? Number)?.toDouble() ?: 0.0
    val guideY = (arguments["guideY"] as? Number)?.toDouble() ?: 0.0
    val guideWidth = (arguments["guideWidth"] as? Number)?.toDouble() ?: 0.0
    val guideHeight = (arguments["guideHeight"] as? Number)?.toDouble() ?: 0.0
    val bufferOrientation = arguments["bufferOrientation"] as? String ?: "portrait"
    val blurThreshold = (arguments["blurThreshold"] as? Number)?.toDouble() ?: 150.0
    val glareThreshold = (arguments["glareThreshold"] as? Number)?.toDouble() ?: 0.05

    var uprightMat: Mat? = null
    var croppedMat: Mat? = null
    var passedAllThresholds = false
    var isDoc = false
    var blurVal = 0.0
    var glarePct = 0.0

    val manager = CardScannerManager.getInstance(proxy.context)

    try {
      uprightMat = normalizeToUprightMat(bgrMat, bufferOrientation)

      val frameW = uprightMat.cols()
      val frameH = uprightMat.rows()

      val scale = maxOf(previewWidth / frameW, previewHeight / frameH)
      val drawnW = frameW * scale
      val drawnH = frameH * scale
      val offX = (previewWidth - drawnW) / 2.0
      val offY = (previewHeight - drawnH) / 2.0

      var rx = (guideX - offX) / scale
      var ry = (guideY - offY) / scale
      var rw = guideWidth / scale
      var rh = guideHeight / scale

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

      croppedMat = Mat(uprightMat, org.opencv.core.Rect(cropX, cropY, cropW, cropH))

      isDoc = manager.isDocumentPresent(croppedMat)
      blurVal = manager.computeBlurScore(croppedMat)
      glarePct = manager.computeGlarePercent(croppedMat)

      passedAllThresholds = isDoc && blurVal >= blurThreshold && glarePct <= glareThreshold

      if (passedAllThresholds) {
        // Delegate heavy cropping/saving task asynchronously to CardScannerManager
        manager.saveAndCropCardAsync(
          bgrMat = bgrMat,
          previewWidth = previewWidth,
          previewHeight = previewHeight,
          guideX = guideX,
          guideY = guideY,
          guideWidth = guideWidth,
          guideHeight = guideHeight,
          bufferOrientation = bufferOrientation,
          blurVal = blurVal,
          glarePct = glarePct
        )
      }
    } catch (_: Exception) {
      passedAllThresholds = false
    } finally {
      croppedMat?.release()
      uprightMat?.release()
      if (!passedAllThresholds) {
        bgrMat.release() // If it doesn't pass, we release the Mat synchronously right here!
      }
    }

    return hashMapOf(
      "isDocumentPresent" to isDoc,
      "blurScore" to blurVal,
      "glarePercent" to glarePct
    )
  }

  private fun normalizeToUprightMat(src: Mat, orientation: String): Mat {
    val out = Mat()
    when (orientation) {
      "portrait" -> src.copyTo(out)
      "landscape-right" -> org.opencv.core.Core.rotate(src, out, org.opencv.core.Core.ROTATE_90_CLOCKWISE)
      "landscape-left" -> org.opencv.core.Core.rotate(src, out, org.opencv.core.Core.ROTATE_90_COUNTERCLOCKWISE)
      "portrait-upside-down" -> org.opencv.core.Core.rotate(src, out, org.opencv.core.Core.ROTATE_180)
      else -> src.copyTo(out)
    }
    return out
  }

  private fun yuvToBgr(image: Image): Mat {
    val width = image.width
    val height = image.height
    val planes = image.planes

    if (image.format != ImageFormat.YUV_420_888) {
      throw IllegalArgumentException("Unsupported image format: ${image.format}")
    }

    val yBuffer = planes[0].buffer
    val uBuffer = planes[1].buffer
    val vBuffer = planes[2].buffer

    val ySize = yBuffer.remaining()
    val uSize = uBuffer.remaining()
    val vSize = vBuffer.remaining()

    val nv21Bytes = ByteArray(width * height * 3 / 2)

    // Copy Y channel
    yBuffer.get(nv21Bytes, 0, ySize)

    val rowStride = planes[1].rowStride
    val pixelStride = planes[1].pixelStride

    if (pixelStride == 2) {
      // Interleaved chroma layout (NV12/NV21)
      val vPlane = planes[2].buffer
      vPlane.get(nv21Bytes, ySize, vSize)
    } else {
      // Planar or non-interleaved layout. Copy pixel by pixel.
      var nvIndex = ySize
      val chromaHeight = height / 2
      val chromaWidth = width / 2
      val uBytes = ByteArray(uSize)
      val vBytes = ByteArray(vSize)
      uBuffer.get(uBytes)
      vBuffer.get(vBytes)

      for (row in 0 until chromaHeight) {
        for (col in 0 until chromaWidth) {
          nv21Bytes[nvIndex++] = vBytes[row * rowStride + col * pixelStride]
          nv21Bytes[nvIndex++] = uBytes[row * rowStride + col * pixelStride]
        }
      }
    }

    val yuvMat = Mat(height + height / 2, width, CvType.CV_8UC1)
    yuvMat.put(0, 0, nv21Bytes)

    val bgrMat = Mat()
    Imgproc.cvtColor(yuvMat, bgrMat, Imgproc.COLOR_YUV2BGR_NV21)
    yuvMat.release()
    return bgrMat
  }

  private fun initOpenCv(): Boolean {
    if (openCvReady) return true
    val ok = try {
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
}
