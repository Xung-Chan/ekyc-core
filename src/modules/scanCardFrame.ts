import { VisionCameraProxy, type Frame } from 'react-native-vision-camera';

const plugin = VisionCameraProxy.initFrameProcessorPlugin('scanCardFrame', {});

export interface ScanCardFrameParams {
  previewWidth: number;
  previewHeight: number;
  guideX: number;
  guideY: number;
  guideWidth: number;
  guideHeight: number;
  bufferOrientation: string;
  throttleMs?: number;
  blurThreshold?: number;
  glareThreshold?: number;
  expectedSide?: string;
}

export interface ScanFrameResult {
  isDocumentPresent: boolean;
  blurScore: number;
  glarePercent: number;
}

export function scanCardFrame(
  frame: Frame,
  params: ScanCardFrameParams
): ScanFrameResult | null {
  'worklet';
  if (plugin == null) {
    throw new Error('Failed to load scanCardFrame frame processor plugin!');
  }
  return plugin.call(frame, params as any) as any;
}
