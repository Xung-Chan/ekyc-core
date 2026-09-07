export const CAMERA_VIDEO_RESOLUTION_FHD = {
  width: 1920,
  height: 1080,
} as const;
export const CAMERA_DEVICE_RETRY_TIMEOUT_MS = 500;
export const CAMERA_DEVICE_INIT_TIMEOUT_MS = 3000;
export const ORIENTATION_PROBE_ORDER = [
  'portrait',
  'landscape-right',
  'portrait-upside-down',
  'landscape-left',
] as const;
