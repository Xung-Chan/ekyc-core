package com.ekyccore

import android.app.Activity
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.vnptit.idg.sdk.activity.VnptIdentityActivity
import com.vnptit.idg.sdk.utils.KeyIntentConstants
import com.vnptit.idg.sdk.utils.SDKEnum

class EkycCoreModule(reactContext: ReactApplicationContext) : NativeEkycCoreSpec(reactContext),
  ActivityEventListener {
  private var ekycPromise: Promise? = null

  override fun getName(): String = NAME

  init {
    reactContext.addActivityEventListener(this)
    Log.d(NAME, "EkycModule initialized")
  }

  override fun startEkyc(promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      Log.e(NAME, "Activity is null - React context may not be ready yet")
      promise.reject("NO_ACTIVITY", "Activity is not available. Please ensure the app is in the foreground and try again.")
      return
    }
    this.ekycPromise = promise
    try {
      val intent = createFullEkycIntent(activity)
      activity.startActivityForResult(intent, EKYC_REQUEST_CODE)
      Log.d(NAME, "eKYC activity started successfully")
    } catch (e: Exception) {
      Log.e(NAME, "Failed to start eKYC activity", e)
      ekycPromise?.reject("EKYC_START_FAILED", "Failed to start eKYC: ${e.message}")
      ekycPromise = null
    }
  }

  override fun getResult(promise: Promise) {
    ekycPromise = promise
    Log.d(NAME, "getResult: Promise registered")
  }
  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?
  ) {
    if (requestCode != EKYC_REQUEST_CODE) return

    if (resultCode == Activity.RESULT_OK && data != null) {
      val result = data.getStringExtra("EKYC_RESULT") ?: ""
      Log.d(NAME, "Result received: $result")

      val resultMap = Arguments.createMap().apply {
        putString("message", result)
      }
      ekycPromise?.resolve(resultMap)
    } else {
      val resultMap = Arguments.createMap().apply {
        putString("message", "User cancelled or failed")
      }
      ekycPromise?.reject("EKYC_FAILED", "User cancelled or failed")
    }

    ekycPromise = null
  }

  override fun onNewIntent(intent: Intent) {
    Log.d(NAME, "onNewIntent")
  }

  private fun createFullEkycIntent(activity: Activity): Intent {
    return Intent(activity, VnptIdentityActivity::class.java).apply {
      // Cấu hình token và key - BẮT BUỘC
      putExtra(KeyIntentConstants.ACCESS_TOKEN,ACCESS_TOKEN)
      putExtra(KeyIntentConstants.TOKEN_ID, TOKEN_ID)
      putExtra(KeyIntentConstants.TOKEN_KEY, TOKEN_KEY)

      // Cấu hình loại tài liệu
      putExtra(KeyIntentConstants.DOCUMENT_TYPE, SDKEnum.DocumentTypeEnum.IDENTITY_CARD.value)

      // Cấu hình phiên bản SDK
      putExtra(KeyIntentConstants.VERSION_SDK, SDKEnum.VersionSDKEnum.ADVANCED.value)

      // Cấu hình hiển thị
      putExtra(KeyIntentConstants.IS_SHOW_TUTORIAL, true)
      putExtra(KeyIntentConstants.IS_ENABLE_GOT_IT, true)

      // Cấu hình so sánh khuôn mặt - BẮT BUỘC để có COMPARE_FACE_RESULT
      putExtra(KeyIntentConstants.IS_ENABLE_COMPARE, true)

      // Cấu hình kiểm tra liveness
      putExtra(KeyIntentConstants.CHECK_LIVENESS_FACE, SDKEnum.ModeCheckLiveNessFace.iBETA.value)
      putExtra(KeyIntentConstants.IS_CHECK_MASKED_FACE, true)
      putExtra(KeyIntentConstants.IS_CHECK_LIVENESS_CARD, true)

      // Cấu hình validation
      putExtra(KeyIntentConstants.IS_VALIDATE_POSTCODE, true)
      putExtra(
        KeyIntentConstants.VALIDATE_DOCUMENT_TYPE,
        SDKEnum.ValidateDocumentType.Basic.value
      )

      // Cấu hình ngôn ngữ
      putExtra(KeyIntentConstants.LANGUAGE_SDK, SDKEnum.LanguageEnum.VIETNAMESE.value)

      // Cấu hình scan QR code
      putExtra(KeyIntentConstants.IS_ENABLE_SCAN_QRCODE, true)
    }
  }


  companion object {
    const val NAME = "EkycCore"
    private const val EKYC_REQUEST_CODE = 1001

    const val TOKEN_ID="4fcae791-b633-114b-e063-63199f0a42f2"
    const val TOKEN_KEY="MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAJokjhVVcmxoJ7qtctER6UIMjy/YkHL6DGndw9F6J2OtB71G/dibYkcDBlJHBTBEqWUTc1g3sw3x/QsxkhnxFGECAwEAAQ=="
    const val ACCESS_TOKEN ="bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0cmFuc2FjdGlvbl9pZCI6IjZmMDAyYTk1LTM1NzQtNGQ0NC1iYjQwLTQ4ZjhmYzlkYWRkNiIsInN1YiI6IjRmY2FlMzdmLTZlNGYtNTI5Ni1lMDYzLTYyMTk5ZjBhNTUxMCIsImF1ZCI6WyJyZXN0c2VydmljZSJdLCJ1c2VyX25hbWUiOiJ2aWZvY2kxOTg3QHRhdGVmYXJtLmNvbSIsInNjb3BlIjpbInJlYWQiXSwiaXNzIjoiaHR0cHM6Ly9sb2NhbGhvc3QiLCJuYW1lIjoidmlmb2NpMTk4N0B0YXRlZmFybS5jb20iLCJleHAiOjE3NzY2MDczMTQsInV1aWRfYWNjb3VudCI6IjRmY2FlMzdmLTZlNGYtNTI5Ni1lMDYzLTYyMTk5ZjBhNTUxMCIsImF1dGhvcml0aWVzIjpbIlVTRVIiXSwianRpIjoiMGQ0ZGQ3YmMtZTQ3Ny00Njk4LTg5NDMtNDMxZDcxZjk5OWFlIiwiY2xpZW50X2lkIjoiOF9ob3VyIn0.Nj1uXH1rLBPlKl_WtaVmo8JHn8Agrk578IgNJTw5Ls5eW2FqpN07r5jlqM-DyxiJozlF0D5NSw3a71tfuiWttcqr-p-0l2QWBJhB4MVfFPQNBhnPdCeB07bGbHxO7aDK7nSXb01ml_ioQHe3fJ-7ZsMl7h5PKhBbv1lW9UhUpamIkhRLse5cezpDtHqDWYhpl6vJedgQG4b00BC50PwS1vzi-1lsgNYkzx3RlicSQwjtdNtornmP5RX5hmWAkLdzz6niazf1RbEgoIwMwIS-6MdKcM_t5UTdkkuxzrfpXv2W-cj4h5k9g20Dg1sx5TLSvDB-KFkFvsmu841B9e5LjQ"
  }
}
