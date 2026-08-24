package com.ekyccore.cardscanner

import com.ekyccore.NativeCardScannerSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry

@ReactModule(name = CardScannerModule.NAME)
class CardScannerModule(private val reactContext: ReactApplicationContext) :
    NativeCardScannerSpec(reactContext), CardScannerManager.CardScannerEventListener {
    //todo dependency injection
    private val manager = CardScannerManager.getInstance(reactContext)

    //todo using for auto capture
    init {
        manager.setEventListener(this)

        // Register custom Frame Processor Plugin
        FrameProcessorPluginRegistry.addFrameProcessorPlugin("scanCardFrame") { proxy, options ->
            CardScannerFrameProcessorPlugin(proxy, options)
        }
    }

    override fun getName(): String = NAME

    companion object {
        const val NAME = "CardScanner"
    }

    override fun cropCardImageOnly(params: ReadableMap, promise: Promise?) {
        val dto = CropCardImageOnlyParams.fromReadableMap(params)
        val imagePath = dto.imagePath
        val crop = dto.crop

        if (imagePath.isBlank() || crop == null) {
            promise?.resolve(
                buildCropOnlyError(
                    imagePath,
                    "INVALID_INPUT",
                    "imagePath and crop are required",
                ),
            )
            return
        }

        if (crop.width <= 0 || crop.height <= 0) {
            promise?.resolve(
                buildCropOnlyError(
                    imagePath,
                    "INVALID_INPUT",
                    "crop.width and crop.height must be positive",
                ),
            )
            return
        }

        manager.cropCardImage(
            imagePath = imagePath,
            cx = crop.x,
            cy = crop.y,
            cw = crop.width,
            ch = crop.height,
            cropCoordinateSpace = dto.cropCoordinateSpace,
            bufferOrientation = dto.bufferOrientation,
            sourcePhotoW = dto.sourcePhotoWidth,
            sourcePhotoH = dto.sourcePhotoHeight,
            debugGallery = dto.manualCaptureDebugSaveToGallery,
            callback = object : CardScannerManager.CropCallback {
                override fun onSuccess(result: Map<String, Any>) {
                    promise?.resolve(mapToWritableMap(result))
                }

                override fun onFailure(errorCode: String, errorMessage: String, debugDetails: Map<String, Any>?) {
                    promise?.resolve(
                        Arguments.createMap().apply {
                            putBoolean("success", false)
                            putString("originalImagePath", imagePath)
                            putBoolean("debugSavedToGallery", false)
                            putString("errorCode", errorCode)
                            putString("errorMessage", errorMessage)
                            debugDetails?.let { putMap("cropDebug", mapToWritableMap(it)) }
                        }
                    )
                }
            }
        )
    }

    override fun deleteLocalImages(paths: ReadableArray, promise: Promise?) {
        val list = ArrayList<String>()
        for (i in 0 until paths.size()) {
            try {
                paths.getString(i)?.let { list.add(it) }
            } catch (_: Throwable) {
            }
        }

        manager.deleteLocalImages(list, object : CardScannerManager.CleanupCallback {
            override fun onSuccess(deleted: Int, skipped: Int) {
                promise?.resolve(
                    Arguments.createMap().apply {
                        putInt("deleted", deleted)
                        putInt("skipped", skipped)
                    }
                )
            }

            override fun onFailure(throwable: Throwable) {
                promise?.reject("DELETE_LOCAL_IMAGES_FAILED", throwable.message ?: throwable.toString(), throwable)
            }
        })
    }

    override fun scrubCardScannerTempFiles(exclude: ReadableArray?, promise: Promise?) {
        val excludeList = exclude?.let {
            val list = ArrayList<String>()
            for (i in 0 until it.size()) {
                try {
                    it.getString(i)?.let { s -> list.add(s) }
                } catch (_: Throwable) {
                }
            }
            list
        }

        manager.scrubCardScannerTempFiles(excludeList, object : CardScannerManager.CleanupCallback {
            override fun onSuccess(deleted: Int, skipped: Int) {
                promise?.resolve(
                    Arguments.createMap().apply {
                        putInt("deleted", deleted)
                        putInt("skipped", skipped)
                    }
                )
            }

            override fun onFailure(throwable: Throwable) {
                promise?.reject("SCRUB_TEMP_FILES_FAILED", throwable.message ?: throwable.toString(), throwable)
            }
        })
    }

    override fun addListener(eventName: String?) {
        // Required for NativeEventEmitter
    }

    override fun removeListeners(count: Double) {
        // Required for NativeEventEmitter
    }

    // --- CardScannerEventListener Callbacks ---

    override fun onCardCaptured(
        croppedImagePath: String,
        blurScore: Double,
        glarePercent: Double,
        appliedX: Int,
        appliedY: Int,
        appliedWidth: Int,
        appliedHeight: Int
    ) {
        val event = Arguments.createMap().apply {
            putBoolean("success", true)
            putString("croppedImagePath", croppedImagePath)
            putDouble("blurScore", blurScore)
            putDouble("glarePercent", glarePercent)
            putMap("appliedCrop", Arguments.createMap().apply {
                putInt("x", appliedX)
                putInt("y", appliedY)
                putInt("width", appliedWidth)
                putInt("height", appliedHeight)
            })
        }
        sendEvent("onCardCaptured", event)
    }

    override fun onCardCaptureFailed(errorCode: String, errorMessage: String) {
        val event = Arguments.createMap().apply {
            putBoolean("success", false)
            putString("errorCode", errorCode)
            putString("errorMessage", errorMessage)
        }
        sendEvent("onCardCaptured", event)
    }

    // --- Helper Methods ---

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactApplicationContext.hasActiveReactInstance()) {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    private fun buildCropOnlyError(path: String, code: String, message: String) =
        Arguments.createMap().apply {
            putBoolean("success", false)
            putString("originalImagePath", path)
            putBoolean("debugSavedToGallery", false)
            putString("errorCode", code)
            putString("errorMessage", message)
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

    @Suppress("UNCHECKED_CAST")
    private fun mapToWritableMap(map: Map<String, Any?>): WritableMap {
        val writable = Arguments.createMap()
        for ((key, value) in map) {
            when (value) {
                null -> writable.putNull(key)
                is Boolean -> writable.putBoolean(key, value)
                is Int -> writable.putInt(key, value)
                is Double -> writable.putDouble(key, value)
                is Float -> writable.putDouble(key, value.toDouble())
                is Long -> writable.putDouble(key, value.toDouble())
                is String -> writable.putString(key, value)
                is Map<*, *> -> writable.putMap(key, mapToWritableMap(value as Map<String, Any?>))
                is List<*> -> {
                    val array = Arguments.createArray()
                    for (item in value) {
                        when (item) {
                            null -> array.pushNull()
                            is Boolean -> array.pushBoolean(item)
                            is Int -> array.pushInt(item)
                            is Double -> array.pushDouble(item)
                            is String -> array.pushString(item)
                            is Map<*, *> -> array.pushMap(mapToWritableMap(item as Map<String, Any?>))
                        }
                    }
                    writable.putArray(key, array)
                }
            }
        }
        return writable
    }
}
