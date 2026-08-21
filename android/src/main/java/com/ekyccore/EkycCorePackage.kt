package com.ekyccore

import com.ekyccore.cardscanner.CardScannerModule
import com.ekyccore.faceportrait.FacePortraitModule
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class EkycCorePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return when (name) {
      FacePortraitModule.NAME -> FacePortraitModule(reactContext)
      CardScannerModule.NAME -> CardScannerModule(reactContext)
      else -> null
    }
  }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
      mapOf(
          FacePortraitModule.NAME to ReactModuleInfo(
              name = FacePortraitModule.NAME,
              className = FacePortraitModule.NAME,
              canOverrideExistingModule = false,
              needsEagerInit = false,
              isCxxModule = false,
              isTurboModule = true
          ),
          CardScannerModule.NAME to ReactModuleInfo(
              name = CardScannerModule.NAME,
              className = CardScannerModule.NAME,
              canOverrideExistingModule = false,
              needsEagerInit = false,
              isCxxModule = false,
              isTurboModule = true
          )
      )
  }
}
