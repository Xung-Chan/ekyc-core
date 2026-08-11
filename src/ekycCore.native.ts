import type { VerifyCccdResult } from '.';
import EkycCore from './NativeEkycCore';

export function startEkyc(): Promise<VerifyCccdResult> {
  return EkycCore.startEkyc();
}

export function getResult(): Promise<string> {
  return EkycCore.getResult();
}
