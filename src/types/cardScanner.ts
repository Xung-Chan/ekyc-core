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
  expectedSide?: 'front' | 'back';
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
  side?: string;
  sideFrontScore?: number;
  sideBackScore?: number;
  blurScore?: number;
  glarePercent?: number;
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
