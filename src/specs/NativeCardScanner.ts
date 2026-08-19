import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropCardImageOnlyParams {
  imagePath: string;
  crop: CropRect;
  cropCoordinateSpace?: string;
  bufferOrientation?: string;
  sourcePhotoWidth?: number;
  sourcePhotoHeight?: number;
  manualCaptureDebugSaveToGallery?: boolean;
}

export interface CropCardImageOnlyDebug {
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
}

export interface CropCardImageOnlyResult {
  success: boolean;
  originalImagePath: string;
  croppedImagePath?: string;
  appliedCrop?: CropRect;
  cropDebug?: CropCardImageOnlyDebug;
  debugSavedToGallery: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface CleanUpResult {
  deleted: number;
  skipped: number;
}

export interface Spec extends TurboModule {
  cropCardImageOnly(
    params: CropCardImageOnlyParams
  ): Promise<CropCardImageOnlyResult>;
  deleteLocalImages(paths: string[]): Promise<CleanUpResult>;
  scrubCardScannerTempFiles(exclude: string[] | null): Promise<CleanUpResult>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('CardScanner');
