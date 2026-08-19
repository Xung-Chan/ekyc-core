package com.faceportrait.scanner

import android.content.Context

object CardScannerPipelineHolder {
  @Volatile
  private var instance: CardScannerPipeline? = null

  fun get(context: Context): CardScannerPipeline {
    val existing = instance
    if (existing != null) {
      return existing
    }
    return synchronized(this) {
      instance ?: CardScannerPipeline(context.applicationContext).also { instance = it }
    }
  }

  fun clearInstance() {
    synchronized(this) {
      instance = null
    }
  }
}
