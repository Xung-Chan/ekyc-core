import { useEffect, useState } from 'react';
import { useCameraDevice, useCameraFormat } from 'react-native-vision-camera';

import { Dimensions } from 'react-native';

import {
  CAMERA_VIDEO_RESOLUTION_FHD,
  CAMERA_DEVICE_RETRY_TIMEOUT_MS,
  CAMERA_DEVICE_INIT_TIMEOUT_MS,
} from '../constants';

const SCREEN = Dimensions.get('window');

export function useCardScannerCameraDevice(
  targetFps: number,
  onAutoRetry: () => void
) {
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { fps: targetFps },
    { videoResolution: CAMERA_VIDEO_RESOLUTION_FHD },
    { videoAspectRatio: SCREEN.height / SCREEN.width },
    { photoAspectRatio: SCREEN.height / SCREEN.width },
  ]);
  const [isTimeout, setIsTimeout] = useState(false);

  useEffect(() => {
    if (device != null) {
      setIsTimeout(false);
      return undefined;
    }

    const retryTimer = setTimeout(() => {
      onAutoRetry();
    }, CAMERA_DEVICE_RETRY_TIMEOUT_MS);

    const timeoutTimer = setTimeout(() => {
      setIsTimeout(true);
    }, CAMERA_DEVICE_INIT_TIMEOUT_MS);

    return () => {
      clearTimeout(retryTimer);
      clearTimeout(timeoutTimer);
    };
  }, [device, onAutoRetry]);

  return { device, format, isTimeout };
}
