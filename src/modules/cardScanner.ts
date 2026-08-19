import type { CropCardImageOnlyParams, CropCardImageOnlyResult } from '../type';

export function cropCardImageOnly(
  _params: CropCardImageOnlyParams
): Promise<CropCardImageOnlyResult> {
  throw new Error("'CardScanner' is only supported on native platforms.");
}

export function deleteLocalImages(
  _paths: string[]
): Promise<{ deleted: number; skipped: number }> {
  throw new Error("'CardScanner' is only supported on native platforms.");
}

export function scrubCardScannerTempFiles(
  _exclude: string[] | null
): Promise<{ deleted: number; skipped: number }> {
  throw new Error("'CardScanner' is only supported on native platforms.");
}
