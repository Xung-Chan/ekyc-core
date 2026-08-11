import { TurboModuleRegistry, type TurboModule } from 'react-native';
import type { VerifyCccdResult } from '.';

export interface Spec extends TurboModule {
  startEkyc(): Promise<VerifyCccdResult>;
  getResult(): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EkycCore');
