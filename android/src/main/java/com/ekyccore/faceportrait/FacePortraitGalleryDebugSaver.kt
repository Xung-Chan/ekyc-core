package com.ekyccore.faceportrait

import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import java.io.File
import java.io.FileOutputStream

/**
 * Lưu JPEG preview detect vào **Pictures/EkycSdkDebug** (hiện trong app Ảnh / Google Photos).
 * Có throttle để tránh tạo quá nhiều file khi frame processor chạy liên tục.
 */
internal object FacePortraitGalleryDebugSaver {

  private const val TAG = "FacePortraitGallery"
  private val relPath = Environment.DIRECTORY_PICTURES + "/EkycSdkDebug"
  private val lock = Any()

  @Volatile
  private var lastSaveMs = 0L

  /** Cách tối thiểu giữa hai lần lưu vào Pictures (không phải “mỗi N frame”). */
  private const val MIN_INTERVAL_MS = 1500L

  fun saveJpegIfNeeded(appContext: Context, jpegBytes: ByteArray): Boolean {
    if (jpegBytes.isEmpty()) return false
    synchronized(lock) {
      val now = System.currentTimeMillis()
      val delta = now - lastSaveMs
      if (delta < MIN_INTERVAL_MS) {
        Log.d(TAG, "gallery save skipped (throttle ${MIN_INTERVAL_MS}ms, còn ~${MIN_INTERVAL_MS - delta}ms)")
        return false
      }
      lastSaveMs = now
    }
    val name = "face_preview_detect_${System.currentTimeMillis()}.jpg"
    return try {
      persistJpegBytes(appContext, jpegBytes, name)
      Log.i(TAG, "Saved to gallery: $relPath/$name")
      true
    } catch (e: Exception) {
      Log.w(TAG, "gallery save failed", e)
      false
    }
  }

  private fun persistJpegBytes(appContext: Context, bytes: ByteArray, name: String): Boolean {
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
      val uri = resolver.insert(collection, values) ?: return false
      resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: return false
      values.clear()
      values.put(MediaStore.MediaColumns.IS_PENDING, 0)
      resolver.update(uri, values, null, null)
      return true
    }
    @Suppress("DEPRECATION")
    val pictures =
      Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
    val dir = File(pictures, "EkycSdkDebug")
    if (!dir.exists() && !dir.mkdirs()) return false
    val file = File(dir, name)
    FileOutputStream(file).use { it.write(bytes) }
    MediaScannerConnection.scanFile(
      appContext,
      arrayOf(file.absolutePath),
      arrayOf("image/jpeg"),
      null,
    )
    return true
  }
}
