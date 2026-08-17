package com.faceportrait.dto

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap


data class FacePortraitCameraConfig(
    /** Bật chụp tự động khi đủ frame `ready` liên tiếp. */
    val autoCapture: Boolean? = null,
    /**
     * Chiều cao ảnh crop = (chiều cao bbox mặt) × (1 + giá trị này).
     * 0.45 ≈ mở rộng thêm ~45% quanh chiều cao mặt.
     */
    val faceCropHeightExpansion: Double? = null,
    /** Độ rộng khung hướng dẫn so với chiều ngang preview (0–1). */
    val guideWidthFraction: Double? = null,
    /** width / height của khung (mặt dọc thường ~0.65–0.75). */
    val guideAspectRatio: Double? = null,
    /** Tâm khung theo trục dọc preview (0–1). */
    val guideCenterYFraction: Double? = null,
    /** face_height/guide_height tối thiểu để `ready` (vd. 0.6 ≈ 60% chiều cao khung). */
    val faceTargetFillMin: Double? = null,
    /**
     * Ngưỡng **quá gần**: `min(face_height/guide_height, face_width/guide_width)` vượt quá giá trị này
     * → `too_close` (cả hai chiều đều lớn trong khung). Mặt cao nhưng hẹp ngang vẫn có thể `ready`.
     * Mặc định SDK **0.9**; chặt hơn thử ~0.78–0.85.
     */
    val faceTargetFillMax: Double? = null,
    /**
     * Mở rộng **hình chữ nhật guide** theo tỉ lệ chiều ngang/dọc trước khi kiểm tra bbox ML nằm trong khung (`not_in_frame`).
     * Bbox detector thường ôm cả tóc/tai, lớn hơn vùng mặt trong oval — mặc định **0.08** (~8% mỗi hướng). `0` = khớp sát guide; tăng nếu vẫn báo oan.
     */
    val guideFaceContainmentPaddingFraction: Double? = null,
    val frameThrottleMs: Int? = null,
    val autoCaptureStableFrameCount: Int? = null,
    /** Lăn đầu trái/phải; mặc định ~30° (selfie thoải mái). Chặt hơn: 18–22. */
    val maxAbsRollDeg: Double? = null,
    /** Quay mặt trái/phải; mặc định ~25°. Chặt hơn: 12–16. */
    val maxAbsYawDeg: Double? = null,
    /** Cúi/ngửa; mặc định ~28°. Chặt hơn: 14–18. */
    val maxAbsPitchDeg: Double? = null,
    /** Trung bình luma (0–255) vùng mặt; trên ngưỡng → glare. */
    val glareMeanLumaThreshold: Double? = null,
    /**
     * Sau `takePhoto`, native có chạy detect mặt trên JPEG full hay không.
     * `true` (mặc định): chặn lưu nếu ảnh tĩnh không có mặt (`no_face_on_still`) — preview và ảnh chụp là hai luồng khác nhau.
     * `false`: chỉ kiểm tra đọc được file (tin preview `ready`).
     */
    val verifyFaceOnStill: Boolean? = null,
    /**
     * Kiểm tra mắt mở trước khi `ready`. Mặc định bật; tắt nếu môi trường kém sáng / nhiễu.
     */
    val requireEyesOpen: Boolean? = null,
    /**
     * **Android (ML Kit):** xác suất mỗi mắt đang mở [0–1]. Mặc định **0.12** (rất nhẹ — hợp mắt nhỏ).
     * Chặt hơn thử 0.18–0.28. Giá trị `-1` từ native = không tính được → bỏ qua phía đó.
     */
    val eyeOpenProbabilityMin: Double? = null,
    /**
     * **iOS (Vision landmark):** tỉ lệ cao/ngang cụm điểm mắt. Mặc định **0.10** — thấp để mắt bé vẫn pass; nhắm mắt thường làm tỉ lệ sụt rõ.
     */
    val eyeOpenLandmarkRatioMin: Double? = null,
)

data class FacePortraitFinalizeParams(
    val imagePath: String,
    val verifyFaceOnStill: Boolean
) {
  companion object {
    private const val IMAGE_PATH = "imagePath"
    private const val CONFIG = "config"
    private const val VERIFY_FACE_ON_STILL = "verifyFaceOnStill"

    fun fromReadableMap(map: ReadableMap): FacePortraitFinalizeParams {
      val rawPath = if (map.hasKey(IMAGE_PATH) && !map.isNull(IMAGE_PATH)) {
        map.getString(IMAGE_PATH)
      } else null

      val path = rawPath?.trim()?.removePrefix("file://")?.trim().orEmpty()

      val configMap = if (map.hasKey(CONFIG)) map.getMap(CONFIG) else null
      val verifyFaceOnStill = if (configMap != null && configMap.hasKey(VERIFY_FACE_ON_STILL)) {
        configMap.getBoolean(VERIFY_FACE_ON_STILL)
      } else {
        true
      }

      return FacePortraitFinalizeParams(path, verifyFaceOnStill)
    }
  }
}

data class FacePortraitFinalizeResult(
  val success: Boolean,
  val fullImagePath: String?,
  val faceCropPath: String? = null,
  val error: String? = null,
  val debugStillImage: ReadableMap? = null
) {
  fun toWritableMap(): WritableMap {
    return Arguments.createMap().apply {
      putBoolean(SUCCESS, success)
      putString(FULL_IMAGE_PATH, fullImagePath)
      putString(FACE_CROP_PATH, faceCropPath)
      putString(ERROR, error)
      putMap(DEBUG_STILL_IMAGE, debugStillImage)
    }
  }

  companion object {
    private const val SUCCESS = "success"
    private const val FULL_IMAGE_PATH = "fullImagePath"
    private const val FACE_CROP_PATH = "faceCropPath"
    private const val ERROR = "error"
    private const val DEBUG_STILL_IMAGE = "debugStillImage"

    fun fromReadableMap(map: ReadableMap): FacePortraitFinalizeResult {
      val success = if (map.hasKey(SUCCESS)) map.getBoolean(SUCCESS) else false

      val fullImagePath = if (map.hasKey(FULL_IMAGE_PATH) && !map.isNull(FULL_IMAGE_PATH))
        map.getString(FULL_IMAGE_PATH) else null

      val faceCropPath = if (map.hasKey(FACE_CROP_PATH) && !map.isNull(FACE_CROP_PATH))
        map.getString(FACE_CROP_PATH) else null

      val error = if (map.hasKey(ERROR) && !map.isNull(ERROR))
        map.getString(ERROR) else null

      val debugStillImage = if (map.hasKey(DEBUG_STILL_IMAGE) && !map.isNull(DEBUG_STILL_IMAGE))
        map.getMap(DEBUG_STILL_IMAGE) else null

      return FacePortraitFinalizeResult(success, fullImagePath, faceCropPath, error, debugStillImage)
    }
  }
}
