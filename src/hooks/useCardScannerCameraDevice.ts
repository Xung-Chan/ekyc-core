import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { useCameraDevice, useCameraFormat } from 'react-native-vision-camera';

const SCREEN = Dimensions.get('window');

export function useCardScannerCameraDevice(
  targetFps: number,
  onAutoRetry: () => void
) {
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { fps: targetFps },
    { videoResolution: { width: 1920, height: 1080 } },
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
    }, 500);

    const timeoutTimer = setTimeout(() => {
      setIsTimeout(true);
    }, 3000);

    return () => {
      clearTimeout(retryTimer);
      clearTimeout(timeoutTimer);
    };
  }, [device, onAutoRetry]);

  return { device, format, isTimeout };
}
