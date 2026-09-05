package com.ekyccore.cardscanner

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableMap

data class CropRect(
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int
) {
    fun toWritableMap(): WritableMap {
        return Arguments.createMap().apply {
            putInt("x", x)
            putInt("y", y)
            putInt("width", width)
            putInt("height", height)
        }
    }

    companion object {
        fun fromReadableMap(map: ReadableMap): CropRect {
            val x = readCropCoord(map, "x")
            val y = readCropCoord(map, "y")
            val width = readBufferDimension(map, "width")
            val height = readBufferDimension(map, "height")
            return CropRect(x, y, width, height)
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
    }
}

data class CropCardImageOnlyParams(
    val imagePath: String,
    val crop: CropRect?,
    val cropCoordinateSpace: String,
    val bufferOrientation: String?,
    val sourcePhotoWidth: Int,
    val sourcePhotoHeight: Int,
    val manualCaptureDebugSaveToGallery: Boolean,
    val expectedSide: String?
) {
    companion object {
        private const val IMAGE_PATH = "imagePath"
        private const val CROP = "crop"
        private const val CROP_COORDINATE_SPACE = "cropCoordinateSpace"
        private const val BUFFER_ORIENTATION = "bufferOrientation"
        private const val SOURCE_PHOTO_WIDTH = "sourcePhotoWidth"
        private const val SOURCE_PHOTO_HEIGHT = "sourcePhotoHeight"
        private const val MANUAL_CAPTURE_DEBUG_SAVE_TO_GALLERY = "manualCaptureDebugSaveToGallery"
        private const val EXPECTED_SIDE = "expectedSide"

        fun fromReadableMap(map: ReadableMap): CropCardImageOnlyParams {
            val rawPath = if (map.hasKey(IMAGE_PATH) && !map.isNull(IMAGE_PATH)) {
                map.getString(IMAGE_PATH)
            } else null
            val path = rawPath?.trim()?.removePrefix("file://")?.trim().orEmpty()

            val crop = if (map.hasKey(CROP) && !map.isNull(CROP)) {
                map.getMap(CROP)?.let { CropRect.fromReadableMap(it) }
            } else null

            val cropCoordinateSpace = if (map.hasKey(CROP_COORDINATE_SPACE) && !map.isNull(CROP_COORDINATE_SPACE)) {
                map.getString(CROP_COORDINATE_SPACE) ?: "raw"
            } else "raw"

            val bufferOrientation = if (map.hasKey(BUFFER_ORIENTATION) && !map.isNull(BUFFER_ORIENTATION)) {
                map.getString(BUFFER_ORIENTATION)
            } else null

            val sourcePhotoWidth = readBufferDimension(map, SOURCE_PHOTO_WIDTH)
            val sourcePhotoHeight = readBufferDimension(map, SOURCE_PHOTO_HEIGHT)
            val manualCaptureDebugSaveToGallery = readOptionalBool(map, MANUAL_CAPTURE_DEBUG_SAVE_TO_GALLERY)
            val expectedSide = if (map.hasKey(EXPECTED_SIDE) && !map.isNull(EXPECTED_SIDE)) {
                map.getString(EXPECTED_SIDE)
            } else null

            return CropCardImageOnlyParams(
                imagePath = path,
                crop = crop,
                cropCoordinateSpace = cropCoordinateSpace,
                bufferOrientation = bufferOrientation,
                sourcePhotoWidth = sourcePhotoWidth,
                sourcePhotoHeight = sourcePhotoHeight,
                manualCaptureDebugSaveToGallery = manualCaptureDebugSaveToGallery,
                expectedSide = expectedSide
            )
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
    }
}

data class CropCardImageOnlyDebug(
    val cropCoordinateSpace: String,
    val decodedWidth: Int,
    val decodedHeight: Int,
    val exifOrientation: Int? = null,
    val normalizedWidth: Int? = null,
    val normalizedHeight: Int? = null,
    val bufferOrientation: String? = null,
    val expectedUprightWidth: Int? = null,
    val expectedUprightHeight: Int? = null,
    val skippedUprightRotation: Boolean,
    val sourcePhotoWidth: Int? = null,
    val sourcePhotoHeight: Int? = null
) {
    fun toWritableMap(): WritableMap {
        return Arguments.createMap().apply {
            putString("cropCoordinateSpace", cropCoordinateSpace)
            putInt("decodedWidth", decodedWidth)
            putInt("decodedHeight", decodedHeight)
            exifOrientation?.let { putInt("exifOrientation", it) }
            normalizedWidth?.let { putInt("normalizedWidth", it) }
            normalizedHeight?.let { putInt("normalizedHeight", it) }
            bufferOrientation?.let { putString("bufferOrientation", it) }
            expectedUprightWidth?.let { putInt("expectedUprightWidth", it) }
            expectedUprightHeight?.let { putInt("expectedUprightHeight", it) }
            putBoolean("skippedUprightRotation", skippedUprightRotation)
            sourcePhotoWidth?.let { putInt("sourcePhotoWidth", it) }
            sourcePhotoHeight?.let { putInt("sourcePhotoHeight", it) }
        }
    }
}

data class CropCardImageOnlyResult(
    val success: Boolean,
    val originalImagePath: String,
    val croppedImagePath: String? = null,
    val appliedCrop: CropRect? = null,
    val cropDebug: CropCardImageOnlyDebug? = null,
    val debugSavedToGallery: Boolean = false,
    val errorCode: String? = null,
    val errorMessage: String? = null
) {
    fun toWritableMap(): WritableMap {
        return Arguments.createMap().apply {
            putBoolean("success", success)
            putString("originalImagePath", originalImagePath)
            croppedImagePath?.let { putString("croppedImagePath", it) }
            appliedCrop?.let { putMap("appliedCrop", it.toWritableMap()) }
            cropDebug?.let { putMap("cropDebug", it.toWritableMap()) }
            putBoolean("debugSavedToGallery", debugSavedToGallery)
            errorCode?.let { putString("errorCode", it) }
            errorMessage?.let { putString("errorMessage", it) }
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


data class ScanCardFrameParams(
    val previewWidth: Double = 0.0,
    val previewHeight: Double = 0.0,
    val guideX: Double = 0.0,
    val guideY: Double = 0.0,
    val guideWidth: Double = 0.0,
    val guideHeight: Double = 0.0,
    val bufferOrientation: String = "portrait",
    val throttleMs: Long = 200L,
    val blurThreshold: Double = 150.0,
    val glareThreshold: Double = 0.08,
    val expectedSide: String? = null
) {
    companion object {
        fun fromMap(arguments: Map<String, Any>?): ScanCardFrameParams {
            if (arguments == null) return ScanCardFrameParams()
            return ScanCardFrameParams(
                previewWidth = (arguments["previewWidth"] as? Number)?.toDouble() ?: 0.0,
                previewHeight = (arguments["previewHeight"] as? Number)?.toDouble() ?: 0.0,
                guideX = (arguments["guideX"] as? Number)?.toDouble() ?: 0.0,
                guideY = (arguments["guideY"] as? Number)?.toDouble() ?: 0.0,
                guideWidth = (arguments["guideWidth"] as? Number)?.toDouble() ?: 0.0,
                guideHeight = (arguments["guideHeight"] as? Number)?.toDouble() ?: 0.0,
                bufferOrientation = arguments["bufferOrientation"] as? String ?: "portrait",
                throttleMs = (arguments["throttleMs"] as? Number)?.toLong() ?: 200L,
                blurThreshold = (arguments["blurThreshold"] as? Number)?.toDouble() ?: 150.0,
                glareThreshold = (arguments["glareThreshold"] as? Number)?.toDouble() ?: 0.08,
                expectedSide = arguments["expectedSide"] as? String
            )
        }
    }
}