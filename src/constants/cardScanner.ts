export const DEFAULT_GUIDE = {
  widthFraction: 0.86,
  aspectRatio: 1.586,
} as const;

// Phần cắt thừa xung quanh khung guide
export const MANUAL_CARD_SCAN_GUIDE_OUTSET = {
  min: 0.1,
  max: 0.15,
  default: 0.125,
} as const;

// Độ lệch AR của ảnh gốc so với AR lý tưởng
export const MANUAL_CROP_SOURCE_STILL_AR_REL_MAX = 0.05;

export const CARD_SCANNER_DEFAULT_THROTTLE_MS = 250;
export const CARD_SCANNER_DEFAULT_BLUR_THRESHOLD = 150.0;
export const CARD_SCANNER_DEFAULT_GLARE_THRESHOLD = 0.08;

// Cấu hình giao diện khung viền
export const FIGMA_GUIDE_W = 375;
export const FIGMA_HOLE_RX = 10;
export const BRACKET_L_CORNER_RADIUS_PX = 10;
