import type { VerifyCccdResult } from '.';

export function startEkyc(): Promise<VerifyCccdResult> {
  throw new Error("'react-native-test' is only supported on native platforms.");
}

export function getResult(): Promise<string> {
  throw new Error("'react-native-test' is only supported on native platforms.");
}
