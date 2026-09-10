import type { CropCardImageOnlyResult, ScanCardResult } from '../types';

export function lBracketPathRoundTopLeft(
  hx: number,
  hy: number,
  brLen: number,
  filletR: number
): string {
  const r = Math.min(filletR, Math.max(0, brLen * 0.48 - 1));
  if (r < 0.25) {
    return `M${hx} ${hy + brLen}L${hx} ${hy}L${hx + brLen} ${hy}`;
  }
  return `M${hx} ${hy + brLen}L${hx} ${hy + r}A${r} ${r} 0 0 1 ${
    hx + r
  } ${hy}L${hx + brLen} ${hy}`;
}

export function lBracketPathRoundTopRight(
  x1: number,
  hy: number,
  brLen: number,
  filletR: number
): string {
  const r = Math.min(filletR, Math.max(0, brLen * 0.48 - 1));
  if (r < 0.25) {
    return `M${x1 - brLen} ${hy}L${x1} ${hy}L${x1} ${hy + brLen}`;
  }
  return `M${x1 - brLen} ${hy}L${x1 - r} ${hy}A${r} ${r} 0 0 1 ${x1} ${
    hy + r
  }L${x1} ${hy + brLen}`;
}

export function lBracketPathRoundBottomLeft(
  hx: number,
  y1: number,
  brLen: number,
  filletR: number
): string {
  const r = Math.min(filletR, Math.max(0, brLen * 0.48 - 1));
  if (r < 0.25) {
    return `M${hx} ${y1 - brLen}L${hx} ${y1}L${hx + brLen} ${y1}`;
  }
  return `M${hx} ${y1 - brLen}L${hx} ${y1 - r}A${r} ${r} 0 0 0 ${
    hx + r
  } ${y1}L${hx + brLen} ${y1}`;
}

export function lBracketPathRoundBottomRight(
  x1: number,
  y1: number,
  brLen: number,
  filletR: number
): string {
  const r = Math.min(filletR, Math.max(0, brLen * 0.48 - 1));
  if (r < 0.25) {
    return `M${x1 - brLen} ${y1}L${x1} ${y1}L${x1} ${y1 - brLen}`;
  }
  return `M${x1 - brLen} ${y1}L${x1 - r} ${y1}A${r} ${r} 0 0 0 ${x1} ${
    y1 - r
  }L${x1} ${y1 - brLen}`;
}

export function manualCropOnlyToScanResult(
  originalPath: string,
  expectedSide: 'front' | 'back' | undefined,
  r: CropCardImageOnlyResult
): ScanCardResult {
  return {
    success: r.success,
    croppedImagePath: r.croppedImagePath,
    originalImagePath: r.originalImagePath || originalPath,
    side: (r.side as 'front' | 'back') || expectedSide || 'unknown',
    blurScore: r.blurScore,
    glarePercent: r.glarePercent,
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
  };
}
