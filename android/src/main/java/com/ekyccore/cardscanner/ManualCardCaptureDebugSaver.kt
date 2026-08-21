package com.ekyccore.cardscanner

import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import org.opencv.android.OpenCVLoader
import org.opencv.core.Mat
import org.opencv.core.MatOfByte
import org.opencv.core.Point
import org.opencv.core.Scalar
import org.opencv.imgcodecs.Imgcodecs
import org.opencv.imgproc.Imgproc
import java.io.File
import java.io.FileOutputStream

object ManualCardCaptureDebugSaver {

  private const val TAG = "EkycManualCaptureDebug"
  private val relPath = Environment.DIRECTORY_PICTURES + "/EkycSdkDebug"

  fun saveFullAndOutline(
    appContext: Context,
    originalPath: String,
    x: Int,
    y: Int,
    w: Int,
    h: Int,
  ): Boolean {
    val okInit =
      try {
        OpenCVLoader.initLocal()
      } catch (_: Throwable) {
        try {
          OpenCVLoader.initDebug()
        } catch (_: Throwable) {
          false
        }
      }
    if (!okInit) {
      Log.w(TAG, "OpenCV not ready")
      return false
    }
    var path = originalPath.trim()
    if (path.startsWith("file://")) {
      path = path.removePrefix("file://")
    }
    val full = Imgcodecs.imread(path)
    if (full.empty()) {
      full.release()
      Log.w(TAG, "imread failed: $path")
      return false
    }
    val ts = System.currentTimeMillis()
    var vis: Mat? = null
    try {
      if (!encodeAndPersist(appContext, full, "ekyc_manual_full_$ts.jpg")) {
        return false
      }
      vis = full.clone()
      Imgproc.rectangle(
        vis,
        Point(x.toDouble(), y.toDouble()),
        Point((x + w).toDouble(), (y + h).toDouble()),
        Scalar(0.0, 0.0, 255.0),
        4,
      )
      return encodeAndPersist(appContext, vis, "ekyc_manual_outline_$ts.jpg")
    } catch (e: Throwable) {
      Log.w(TAG, "saveFullAndOutline: ${e.message}", e)
      return false
    } finally {
      vis?.release()
      full.release()
    }
  }

  private fun encodeAndPersist(appContext: Context, bgr: Mat, fileName: String): Boolean {
    val buf = MatOfByte()
    return try {
      if (!Imgcodecs.imencode(".jpg", bgr, buf)) {
        Log.w(TAG, "imencode failed $fileName")
        false
      } else {
        persistJpegBytes(appContext, buf.toArray(), fileName)
      }
    } finally {
      buf.release()
    }
  }

  private fun persistJpegBytes(appContext: Context, bytes: ByteArray, name: String): Boolean {
    if (bytes.isEmpty()) return false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val values =
        ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, name)
          put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
          put(MediaStore.MediaColumns.RELATIVE_PATH, relPath)
          put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
      val resolver = appContext.contentResolver
      val collection =
        MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
      val uri =
        resolver.insert(collection, values) ?: run {
          Log.w(TAG, "MediaStore insert failed $name")
          return false
        }
      resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: run {
        Log.w(TAG, "openOutputStream failed $name")
        return false
      }
      values.clear()
      values.put(MediaStore.MediaColumns.IS_PENDING, 0)
      resolver.update(uri, values, null, null)
    } else {
      @Suppress("DEPRECATION")
      val pictures =
        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
      val dir = File(pictures, "EkycSdkDebug")
      if (!dir.exists() && !dir.mkdirs()) {
        Log.w(TAG, "mkdirs failed ${dir.path}")
        return false
      }
      val file = File(dir, name)
      FileOutputStream(file).use { it.write(bytes) }
      MediaScannerConnection.scanFile(
        appContext,
        arrayOf(file.absolutePath),
        arrayOf("image/jpeg"),
        null,
      )
    }
    return true
  }
}
