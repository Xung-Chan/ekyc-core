import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { Camera, useCameraPermission } from 'react-native-vision-camera';

export const useInitCardScannerCameraView = (isActive: boolean | undefined) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const didAutoRequestCameraPermissionRef = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const autoRetryCountRef = useRef(0);

  const handleRetry = useCallback(() => {
    autoRetryCountRef.current = 0;
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleAutoRetry = useCallback(() => {
    if (autoRetryCountRef.current < 3) {
      autoRetryCountRef.current += 1;
      setRefreshKey((prev) => prev + 1);
    }
  }, []);

  const openCameraPermissionSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      // no-op
    }
  }, []);

  const handleRequestCameraPermission = useCallback(async () => {
    const before = Camera.getCameraPermissionStatus();
    if (before === 'denied' || before === 'restricted') {
      await openCameraPermissionSettings();
      return;
    }
    const granted = await requestPermission();
    if (!granted) {
      const after = Camera.getCameraPermissionStatus();
      if (after === 'denied' || after === 'restricted') {
        await openCameraPermissionSettings();
      }
    }
  }, [openCameraPermissionSettings, requestPermission]);

  useEffect(() => {
    if (
      !isActive ||
      hasPermission ||
      didAutoRequestCameraPermissionRef.current
    ) {
      return;
    }
    if (Camera.getCameraPermissionStatus() !== 'not-determined') {
      return;
    }
    didAutoRequestCameraPermissionRef.current = true;
    requestPermission().catch(() => {
      // no-op
    });
  }, [hasPermission, isActive, requestPermission]);

  return {
    hasPermission,
    handleRequestCameraPermission,
    handleRetry,
    handleAutoRetry,
    refreshKey,
  };
};
