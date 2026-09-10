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
  croppedImagePath?: string;
  originalImagePath?: string;
  side: 'front' | 'back' | 'unknown';
  blurScore?: number;
  glarePercent?: number;
  errorCode?: string;
  errorMessage?: string;
};

export type CardCapturedEvent =
  | {
      success: true;
      croppedImagePath: string;
      blurScore: number;
      glarePercent: number;
      side: string;
      sideFrontScore: number;
      sideBackScore: number;
      appliedCrop: CropRect;
    }
  | {
      success: false;
      errorCode: string;
      errorMessage: string;
    };
