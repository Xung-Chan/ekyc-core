import type {
  FacePortraitFinalizeParams,
  FacePortraitFinalizeResult,
} from '../specs/NativeFacePortrait';
import FacePortrait from '../specs/NativeFacePortrait';

export async function finalizeFromPath(
  params: FacePortraitFinalizeParams
): Promise<FacePortraitFinalizeResult> {
  const result = await FacePortrait.finalizeFromPath(params);
  console.log('test', result);
  return result;
}
