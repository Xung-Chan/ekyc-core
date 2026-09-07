import type {
  CropCardImageOnlyParams,
  CropCardImageOnlyResult,
} from '../types';
import CardScanner from '../specs/NativeCardScanner';

export async function cropCardImageOnly(
  params: CropCardImageOnlyParams
): Promise<CropCardImageOnlyResult> {
  return CardScanner.cropCardImageOnly(params);
}

export async function deleteLocalImages(
  paths: string[]
): Promise<{ deleted: number; skipped: number }> {
  return CardScanner.deleteLocalImages(paths);
}

export async function scrubCardScannerTempFiles(
  exclude: string[] | null
): Promise<{ deleted: number; skipped: number }> {
  return CardScanner.scrubCardScannerTempFiles(exclude);
}
