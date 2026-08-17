import type {
  FacePortraitFinalizeParams,
  FacePortraitFinalizeResult,
} from '../specs/NativeFacePortrait';

export function finalizeFromPath(
  _params: FacePortraitFinalizeParams
): Promise<FacePortraitFinalizeResult> {
  throw new Error("'FacePortrait' is only supported on native platforms.");
}
