package com.ekyccore.cardscanner

import android.net.Uri
import com.ekyccore.NativeCardScannerSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import java.io.File
import java.util.concurrent.Executors

@ReactModule(name = CardScannerModule.NAME)
class CardScannerModule(private val reactContext: ReactApplicationContext) :
  NativeCardScannerSpec(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()

  private val pipeline by lazy { CardScannerPipelineHolder.get(reactContext) }

  override fun getName(): String = NAME

  companion object {
    const val NAME = "CardScanner"

    private val TEMP_FILE_PREFIXES =
      arrayOf(
        "card_manual_crop_",
        "card_scan_",
        "ekyc_card_warp_",
        "img_cmp_",
        "img_src_",
      )
  }

  override fun cropCardImageOnly(params: ReadableMap, promise: Promise?) {
    val imagePath = if (params.hasKey("imagePath")) params.getString("imagePath") else null
    val cropMap = if (params.hasKey("crop")) params.getMap("crop") else null
    if (imagePath.isNullOrBlank() || cropMap == null) {
      promise?.resolve(
        buildCropOnlyError(
          imagePath ?: "",
          "INVALID_INPUT",
          "imagePath and crop are required",
        ),
      )
      return
    }
    val cx = readCropCoord(cropMap, "x")
    val cy = readCropCoord(cropMap, "y")
    val cw = readBufferDimension(cropMap, "width")
    val ch = readBufferDimension(cropMap, "height")
    if (cw <= 0 || ch <= 0) {
      promise?.resolve(
        buildCropOnlyError(
          imagePath,
          "INVALID_INPUT",
          "crop.width and crop.height must be positive",
        ),
      )
      return
    }
    val debugGallery = readOptionalBool(params, "manualCaptureDebugSaveToGallery")
    val cropCoordinateSpace =
      if (params.hasKey("cropCoordinateSpace")) {
        params.getString("cropCoordinateSpace") ?: "raw"
      } else {
        "raw"
      }
    val bufferOrientation =
      if (params.hasKey("bufferOrientation")) params.getString("bufferOrientation") else null
    val sourcePhotoW = readBufferDimension(params, "sourcePhotoWidth")
    val sourcePhotoH = readBufferDimension(params, "sourcePhotoHeight")

    executor.execute {
      try {
        val r =
          pipeline.cropJpegOnly(
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
        if (!r.success) {
          promise?.resolve(
            Arguments.createMap().apply {
              putBoolean("success", false)
              putString("originalImagePath", imagePath)
              putBoolean("debugSavedToGallery", false)
              putString("errorCode", r.errorCode ?: "CROP_FAILED")
              putString("errorMessage", r.errorMessage ?: "Crop failed")
              putManualCropDebug(this, r)
            },
          )
          return@execute
        }
        val croppedAbs = r.croppedAbsolutePath!!
        var debugSaved = false
        if (debugGallery) {
          debugSaved =
            ManualCardCaptureDebugSaver.saveFullAndOutline(
              reactContext.applicationContext,
              imagePath,
              r.appliedX,
              r.appliedY,
              r.appliedW,
              r.appliedH,
            )
        }
        promise?.resolve(
          Arguments.createMap().apply {
            putBoolean("success", true)
            putString("originalImagePath", imagePath)
            putString("croppedImagePath", "file://$croppedAbs")
            putMap(
              "appliedCrop",
              Arguments.createMap().apply {
                putInt("x", r.appliedX)
                putInt("y", r.appliedY)
                putInt("width", r.appliedW)
                putInt("height", r.appliedH)
              },
            )
            putBoolean("debugSavedToGallery", debugSaved)
            putManualCropDebug(this, r)
          },
        )
      } catch (e: Throwable) {
        promise?.resolve(
          buildCropOnlyError(
            imagePath,
            "PIPELINE_ERROR",
            e.message ?: e.toString(),
          ),
        )
      }
    }
  }

  override fun deleteLocalImages(paths: ReadableArray, promise: Promise?) {
    executor.execute {
      try {
        var deleted = 0
        var skipped = 0
        for (i in 0 until paths.size()) {
          val raw =
            try {
              paths.getString(i)
            } catch (_: Throwable) {
              null
            }
          if (raw.isNullOrBlank()) {
            skipped++
            continue
          }
          when (unlinkAllowedPath(raw)) {
            true -> deleted++
            false -> skipped++
          }
        }
        promise?.resolve(
          Arguments.createMap().apply {
            putInt("deleted", deleted)
            putInt("skipped", skipped)
          },
        )
      } catch (e: Throwable) {
        promise?.reject("DELETE_LOCAL_IMAGES_FAILED", e.message ?: e.toString(), e)
      }
    }
  }

  override fun scrubCardScannerTempFiles(exclude: ReadableArray?, promise: Promise?) {
    executor.execute {
      try {
        val excludeSet = HashSet<String>()
        if (exclude != null) {
          for (i in 0 until exclude.size()) {
            val raw =
              try {
                exclude.getString(i)
              } catch (_: Throwable) {
                null
              }
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
        promise?.resolve(
          Arguments.createMap().apply {
            putInt("deleted", deleted)
            putInt("skipped", skipped)
          },
        )
      } catch (e: Throwable) {
        promise?.reject("SCRUB_TEMP_FILES_FAILED", e.message ?: e.toString(), e)
      }
    }
  }

  private fun allowedTempRoots(): List<File> {
    val ctx = reactContext
    return listOfNotNull(ctx.cacheDir, ctx.codeCacheDir, ctx.externalCacheDir)
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

  private fun readCropCoord(m: ReadableMap, key: String): Int {
    if (!m.hasKey(key)) return 0
    return try {
      when (m.getType(key)) {
        ReadableType.Number -> m.getDouble(key).toInt()
        else -> m.getInt(key)
      }
    } catch (_: Throwable) {
      0
    }
  }

  private fun readOptionalBool(params: ReadableMap, key: String): Boolean {
    if (!params.hasKey(key)) return false
    return try {
      when (params.getType(key)) {
        ReadableType.Boolean -> params.getBoolean(key)
        else -> false
      }
    } catch (_: Throwable) {
      false
    }
  }

  private fun readBufferDimension(params: ReadableMap, key: String): Int {
    if (!params.hasKey(key)) return 0
    return try {
      when (params.getType(key)) {
        ReadableType.Number -> {
          val v = params.getDouble(key)
          if (!v.isFinite() || v < 1) 0 else v.toInt().coerceIn(1, 8192)
        }
        else -> params.getInt(key).coerceAtLeast(0)
      }
    } catch (_: Throwable) {
      0
    }
  }

  private fun putManualCropDebug(
    parent: WritableMap,
    r: CardScannerPipeline.CropJpegOnlyResult,
  ) {
    parent.putMap(
      "cropDebug",
      Arguments.createMap().apply {
        putString("cropCoordinateSpace", r.debugCropCoordinateSpace)
        putInt("decodedWidth", r.debugDecodedWidth)
        putInt("decodedHeight", r.debugDecodedHeight)
        if (r.debugExifOrientation != null) {
          putInt("exifOrientation", r.debugExifOrientation)
        }
        if (r.debugNormalizedWidth != null) {
          putInt("normalizedWidth", r.debugNormalizedWidth)
        }
        if (r.debugNormalizedHeight != null) {
          putInt("normalizedHeight", r.debugNormalizedHeight)
        }
        if (r.debugBufferOrientation != null) {
          putString("bufferOrientation", r.debugBufferOrientation)
        }
        r.debugExpectedUprightWidth?.let { putInt("expectedUprightWidth", it) }
        r.debugExpectedUprightHeight?.let { putInt("expectedUprightHeight", it) }
        putBoolean("skippedUprightRotation", r.debugSkippedUprightRotation)
        if (r.debugSourcePhotoWidth > 0) {
          putInt("sourcePhotoWidth", r.debugSourcePhotoWidth)
        }
        if (r.debugSourcePhotoHeight > 0) {
          putInt("sourcePhotoHeight", r.debugSourcePhotoHeight)
        }
      },
    )
  }

  private fun buildCropOnlyError(path: String, code: String, message: String) =
    Arguments.createMap().apply {
      putBoolean("success", false)
      putString("originalImagePath", path)
      putBoolean("debugSavedToGallery", false)
      putString("errorCode", code)
      putString("errorMessage", message)
    }
}
