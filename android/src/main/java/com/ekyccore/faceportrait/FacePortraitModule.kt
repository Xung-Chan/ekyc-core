package com.ekyccore.faceportrait

import android.util.Log
import com.ekyccore.NativeFacePortraitSpec
import com.ekyccore.faceportrait.dto.FacePortraitFinalizeParams
import com.ekyccore.faceportrait.dto.FacePortraitFinalizeResult
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class FacePortraitModule(reactContext: ReactApplicationContext) :
  NativeFacePortraitSpec(reactContext) {

  private val executor: ExecutorService = Executors.newSingleThreadExecutor()

  override fun getName(): String = NAME

  companion object {
    const val NAME = "FacePortrait"
    private const val LOG_TAG = "EkycFacePortrait"
  }

  override fun finalizeFromPath(
    params: ReadableMap,
    promise: Promise?
  ) {
    executor.execute {
      try {
        val input = FacePortraitFinalizeParams.fromReadableMap(params)
        Log.d(
          LOG_TAG,
          "finalizeFromPath start path=${input.imagePath.takeLast(48)} verifyFaceOnStill=${input.verifyFaceOnStill}",
        )
        val fullFile = File(input.imagePath)
        if (!fullFile.isFile) {
          Log.w(LOG_TAG, "finalizeFromPath file missing or not file: ${input.imagePath}")
          promise?.resolve(
            FacePortraitFinalizeResult(
              success = false,
              fullImagePath = null,
              error = "image file not found"
            ).toWritableMap()
          )
          return@execute
        }

        val (ok, err) = FacePortraitBgrAnalyzer.finalizeFromJpegPath(input.imagePath, input.verifyFaceOnStill)
        if (ok) {
          Log.d(LOG_TAG, "finalizeFromPath success (full image only)")
        } else {
          Log.w(LOG_TAG, "finalizeFromPath failed: ${err ?: "finalize_failed"}")
        }

        val result = FacePortraitFinalizeResult(
          success = ok,
          fullImagePath = "file://${fullFile.absolutePath}",
          error = if (ok) null else (err ?: "finalize_failed")
        )
        promise?.resolve(result.toWritableMap())
      } catch (e: Exception) {
        Log.e(LOG_TAG, "finalizeFromPath exception", e)
        promise?.resolve(
          FacePortraitFinalizeResult(
            success = false,
            fullImagePath = null,
            error = e.message ?: e.toString()
          ).toWritableMap()
        )
      }
    }
  }

  init {
    Log.d(NAME, "EkycModule initialized")
  }
}
