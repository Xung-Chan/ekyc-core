import type { ViewStyle } from 'react-native';

/**
 * Cấu hình gần với card scan: auto, khung hướng dẫn, tỷ lệ khớp (fill), số frame ổn định, crop.
 */
export type FacePortraitCameraConfig = {
  /** Bật chụp tự động khi đủ frame `ready` liên tiếp. */
  autoCapture?: boolean;
  /**
   * Chiều cao ảnh crop = (chiều cao bbox mặt) × (1 + giá trị này).
   * 0.45 ≈ mở rộng thêm ~45% quanh chiều cao mặt.
   */
  faceCropHeightExpansion?: number;
  /** Độ rộng khung hướng dẫn so với chiều ngang preview (0–1). */
  guideWidthFraction?: number;
  /** width / height của khung (mặt dọc thường ~0.65–0.75). */
  guideAspectRatio?: number;
  /** Tâm khung theo trục dọc preview (0–1). */
  guideCenterYFraction?: number;
  /** face_height/guide_height tối thiểu để `ready` (vd. 0.6 ≈ 60% chiều cao khung). */
  faceTargetFillMin?: number;
  /**
   * Ngưỡng **quá gần**: `min(face_height/guide_height, face_width/guide_width)` vượt quá giá trị này
   * → `too_close` (cả hai chiều đều lớn trong khung). Mặt cao nhưng hẹp ngang vẫn có thể `ready`.
   * Mặc định SDK **0.9**; chặt hơn thử ~0.78–0.85.
   */
  faceTargetFillMax?: number;
  /**
   * Mở rộng **hình chữ nhật guide** theo tỉ lệ chiều ngang/dọc trước khi kiểm tra bbox ML nằm trong khung (`not_in_frame`).
   * Bbox detector thường ôm cả tóc/tai, lớn hơn vùng mặt trong oval — mặc định **0.08** (~8% mỗi hướng). `0` = khớp sát guide; tăng nếu vẫn báo oan.
   */
  guideFaceContainmentPaddingFraction?: number;
  frameThrottleMs?: number;
  autoCaptureStableFrameCount?: number;
  /** Lăn đầu trái/phải; mặc định ~30° (selfie thoải mái). Chặt hơn: 18–22. */
  maxAbsRollDeg?: number;
  /** Quay mặt trái/phải; mặc định ~25°. Chặt hơn: 12–16. */
  maxAbsYawDeg?: number;
  /** Cúi/ngửa; mặc định ~28°. Chặt hơn: 14–18. */
  maxAbsPitchDeg?: number;
  /** Trung bình luma (0–255) vùng mặt; trên ngưỡng → glare. */
  glareMeanLumaThreshold?: number;
  /**
   * Sau `takePhoto`, native có chạy detect mặt trên JPEG full hay không.
   * `true` (mặc định): chặn lưu nếu ảnh tĩnh không có mặt (`no_face_on_still`) — preview và ảnh chụp là hai luồng khác nhau.
   * `false`: chỉ kiểm tra đọc được file (tin preview `ready`).
   */
  verifyFaceOnStill?: boolean;
  /**
   * Kiểm tra mắt mở trước khi `ready`. Mặc định bật; tắt nếu môi trường kém sáng / nhiễu.
   */
  requireEyesOpen?: boolean;
  /**
   * **Android (ML Kit):** xác suất mỗi mắt đang mở [0–1]. Mặc định **0.12** (rất nhẹ — hợp mắt nhỏ).
   * Chặt hơn thử 0.18–0.28. Giá trị `-1` từ native = không tính được → bỏ qua phía đó.
   */
  eyeOpenProbabilityMin?: number;
  /**
   * **iOS (Vision landmark):** tỉ lệ cao/ngang cụm điểm mắt. Mặc định **0.10** — thấp để mắt bé vẫn pass; nhắm mắt thường làm tỉ lệ sụt rõ.
   */
  eyeOpenLandmarkRatioMin?: number;
};

export interface FacePortraitCameraViewRef {
  takePhoto: () => Promise<string | null>;
  /**
   * Sau khi chụp + finalize thành công, camera tự tắt session. Gọi `start()` để bật lại preview
   * và xóa trạng thái detect (tương đương một phiên chụp mới).
   */
  start: () => void;
  /** Giống `start()`: bật lại camera nếu đã dừng và reset pipeline detect. */
  reset: () => void;
}

export type FacePortraitGuideFrameConfig = {
  widthFraction?: number;
  aspectRatio?: number;
  centerYFraction?: number;
};

export type FacePortraitCaptureEvent = {
  success: boolean;
  fullImagePath?: string;
  /** Không còn dùng; native chỉ trả ảnh gốc sau finalize. */
  faceCropPath?: string;
  error?: string;
};
export type FacePortraitCameraViewProps = {
  /**
   * `true`: bật frame processor (detect realtime + auto chụp khi ổn định).
   * `false`: không gắn frame processor — chỉ preview + chụp tay (`takePhoto`).
   */
  autoCapture: boolean;
  /**
   * Điều khiển preview (Vision Camera). Kết hợp với trạng thái nội bộ: sau khi chụp + finalize
   * **thành công**, camera tự dừng tới khi gọi ref `start()` / `reset()` hoặc `isActive` từ parent.
   */
  isActive?: boolean;
  targetFps?: number;
  cameraFacing?: 'front' | 'back';
  /**
   * Xoay thêm (CW) khi encode BGR qua resize-plugin.
   * Không truyền hoặc `'auto'`: heuristic theo thiết bị / camera trước.
   */
  // resizePluginExtraRotationCW?: FacePortraitResizePluginExtraCW;
  /** Khung đo layout — nên khớp `config` / SVG mask. */
  guideFrame?: FacePortraitGuideFrameConfig;
  config?: FacePortraitCameraConfig;
  /** Gộp vào hook (không ghi đè `config` / `onAutoCaptureReady`). */
  // nativeFrameOptions?: FacePortraitNativeFrameOptions;
  // onFacePortraitFeedback?: (e: {
  //   nativeEvent: FacePortraitFeedbackEvent;
  // }) => void;
  onFacePortraitCapture?: (e: {
    nativeEvent: FacePortraitCaptureEvent;
  }) => void;
  /** Manual: sau `takePhoto` + `finalizeFromPath`. */
  onPhotoCaptured?: (imagePath: string) => void;
  // formatFeedback?: (
  //   feedback: FacePortraitPreviewFeedback | string | undefined,
  //   detail: string | undefined
  // ) =>
  //   | Partial<Pick<FacePortraitFeedbackEvent, 'hintText' | 'textMessage'>>
  //   | undefined;
  /**
   * Vẽ khung bbox mặt trên preview (theo `faceRectView`). Mặc định `true`.
   * Tắt nếu app tự vẽ overlay (SVG, v.v.).
   */
  showFaceDetectionBox?: boolean;
  style?: ViewStyle;
  children?: React.ReactNode;
};

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropCardImageOnlyParams = {
  imagePath: string;
  crop: CropRect;
  cropCoordinateSpace?: 'raw' | 'upright';
  bufferOrientation?:
    'portrait' | 'portrait-upside-down' | 'landscape-left' | 'landscape-right';
  sourcePhotoWidth?: number;
  sourcePhotoHeight?: number;
  manualCaptureDebugSaveToGallery?: boolean;
};

export type CropCardImageOnlyDebug = {
  cropCoordinateSpace: string;
  decodedWidth: number;
  decodedHeight: number;
  exifOrientation?: number;
  normalizedWidth?: number;
  normalizedHeight?: number;
  bufferOrientation?: string;
  expectedUprightWidth?: number;
  expectedUprightHeight?: number;
  skippedUprightRotation: boolean;
  sourcePhotoWidth?: number;
  sourcePhotoHeight?: number;
};

export type CropCardImageOnlyResult = {
  success: boolean;
  originalImagePath: string;
  croppedImagePath?: string;
  appliedCrop?: CropRect;
  cropDebug?: CropCardImageOnlyDebug;
  debugSavedToGallery: boolean;
  errorCode?: string;
  errorMessage?: string;
};

export type ScanCardResult = {
  success: boolean;
  originalImagePath: string;
  croppedImagePath?: string;
  side: string;
  sideFrontScore: number;
  sideBackScore: number;
  quality: {
    passed: boolean;
    blurScore: number;
    motionScore: number;
    glareScore: number;
    exposure: string;
    reasons: string[];
  };
  appliedCrop?: CropRect;
  manualCaptureDebugSavedToGallery: boolean;
  errorCode?: string;
  errorMessage?: string;
};
