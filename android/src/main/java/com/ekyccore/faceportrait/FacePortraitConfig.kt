package com.ekyccore.faceportrait

import com.facebook.react.bridge.ReadableMap
import kotlin.math.min

internal data class FacePortraitConfig(
  val autoCapture: Boolean = true,
  /** Crop height = faceHeight * (1 + faceCropHeightExpansion). Thường 0.4–0.5. */
  val faceCropHeightExpansion: Double = 0.45,
  val guideWidthFraction: Double = 0.72,
  /** width / height của khung hướng dẫn (mặt dọc → ~0.65–0.75). */
  val guideAspectRatio: Double = 0.7,
  val guideCenterYFraction: Double = 0.42,
  val faceTargetFillMin: Double = 0.6,
  val faceTargetFillMax: Double = 0.9,
  /**
   * Nới guide theo tỉ lệ chiều ngang/dọc khi kiểm tra bbox ⊆ guide (tránh `not_in_frame` oan vì bbox ML > vùng oval).
   */
  val guideFaceContainmentPaddingFraction: Float = 0.08f,
  val frameThrottleMs: Int = 90,
  val autoCaptureStableFrameCount: Int = 8,
  val maxAbsRollDeg: Float = 30f,
  val maxAbsYawDeg: Float = 25f,
  val maxAbsPitchDeg: Float = 28f,
  val glareMeanLumaThreshold: Float = 232f,
  val requireEyesOpen: Boolean = true,
  /**
   * ML Kit: xác suất mỗi mắt đang mở [0–1]. Mặc định thấp để hợp mắt nhỏ / nửa nhắm vẫn pass.
   * Chặt hơn: 0.18–0.35.
   */
  val eyeOpenProbabilityMin: Float = 0.12f,
) {
  companion object {
    fun fromMap(m: ReadableMap?): FacePortraitConfig {
      if (m == null) return FacePortraitConfig()
      fun d(key: String, def: Double): Double =
        if (m.hasKey(key)) m.getDouble(key) else def
      fun i(key: String, def: Int): Int =
        if (m.hasKey(key)) m.getInt(key) else def
      fun f(key: String, def: Float): Float =
        if (m.hasKey(key)) m.getDouble(key).toFloat() else def
      fun b(key: String, def: Boolean): Boolean =
        if (m.hasKey(key)) m.getBoolean(key) else def
      return FacePortraitConfig(
        autoCapture = b("autoCapture", true),
        faceCropHeightExpansion = min(d("faceCropHeightExpansion", 0.45), 1.0),
        guideWidthFraction = d("guideWidthFraction", 0.72).coerceIn(0.2, 0.98),
        guideAspectRatio = d("guideAspectRatio", 0.7).coerceIn(0.3, 2.0),
        guideCenterYFraction = d("guideCenterYFraction", 0.42).coerceIn(0.15, 0.85),
        faceTargetFillMin = d("faceTargetFillMin", 0.6).coerceIn(0.05, 0.9),
        faceTargetFillMax = d("faceTargetFillMax", 0.9).coerceIn(0.1, 1.0),
        guideFaceContainmentPaddingFraction =
          f("guideFaceContainmentPaddingFraction", 0.08f).coerceIn(0f, 0.25f),
        frameThrottleMs = i("frameThrottleMs", 90).coerceIn(40, 500),
        autoCaptureStableFrameCount =
          i("autoCaptureStableFrameCount", 8).coerceIn(1, 60),
        maxAbsRollDeg = f("maxAbsRollDeg", 30f),
        maxAbsYawDeg = f("maxAbsYawDeg", 25f),
        maxAbsPitchDeg = f("maxAbsPitchDeg", 28f),
        glareMeanLumaThreshold = f("glareMeanLumaThreshold", 232f),
        requireEyesOpen = b("requireEyesOpen", true),
        eyeOpenProbabilityMin =
          f("eyeOpenProbabilityMin", 0.12f).coerceIn(0.05f, 0.95f),
      )
    }
  }
}
