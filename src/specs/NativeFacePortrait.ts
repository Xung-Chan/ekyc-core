import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface FacePortraitFinalizeParams {
  imagePath: string;
}

export interface FacePortraitFinalizeResult {
  success: boolean;
  fullImagePath?: string;
  faceCropPath?: string;
  error?: string;
  debugStillImage?: Object;
}

export interface Spec extends TurboModule {
  finalizeFromPath: (
    params: FacePortraitFinalizeParams
  ) => Promise<FacePortraitFinalizeResult>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('FacePortrait');
