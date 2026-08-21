import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, Mask, Path, Rect as SvgRect } from 'react-native-svg';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';

import { cropCardImageOnly } from '../modules/cardScanner';
import {
  computeCardScannerGuideRectInPreview,
  computePhotoRawCropRectForCardScan,
  type Orientation,
} from '../modules/photoGuideCropRect';
import type { CropCardImageOnlyResult, ScanCardResult } from '../type';

const SCREEN = Dimensions.get('window');

const DEFAULT_GUIDE = {
  widthFraction: 0.86,
  aspectRatio: 1.586,
};

const FIGMA_GUIDE_W = 375;
const FIGMA_HOLE_RX = 10;
const BRACKET_L_CORNER_RADIUS_PX = 10;

function lBracketPathRoundTopLeft(
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

function lBracketPathRoundTopRight(
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

function lBracketPathRoundBottomLeft(
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

function lBracketPathRoundBottomRight(
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

function manualCropOnlyToScanResult(
  originalPath: string,
  expectedSide: 'front' | 'back' | undefined,
  r: CropCardImageOnlyResult
): ScanCardResult {
  return {
    success: r.success,
    originalImagePath: r.originalImagePath || originalPath,
    croppedImagePath: r.croppedImagePath,
    side: expectedSide ?? 'unknown',
    sideFrontScore: 0,
    sideBackScore: 0,
    quality: {
      passed: r.success,
      blurScore: 0,
      motionScore: 0,
      glareScore: 0,
      exposure: 'ok',
      reasons: r.success ? [] : [r.errorCode ?? 'CROP_FAILED'],
    },
    appliedCrop: r.appliedCrop,
    manualCaptureDebugSavedToGallery: r.debugSavedToGallery,
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
  };
}

export type CardScannerCameraViewGuideConfig = {
  widthFraction?: number;
  aspectRatio?: number;
};

export interface CardScannerCameraViewProps {
  isActive?: boolean;
  targetFps?: number;
  guideFrame?: CardScannerCameraViewGuideConfig;
  expectedSide?: 'front' | 'back';
  onPhotoCaptured?: (imagePath: string, scanResult: ScanCardResult) => void;
  style?: ViewStyle;
  children?: React.ReactNode;
  showGuide?: boolean;
  onRetry?: () => void;
}
export interface CardScannerCameraInnerProps extends CardScannerCameraViewProps {
  onAutoRetry: () => void;
}

export type CardScannerCameraViewRef = {
  takePhoto: () => Promise<string | null>;
  stop: () => void;
  start: () => void;
  reset: () => void;
};

// Child component that actually accesses the camera and calls useCameraDevice.
// Separated so hook execution only starts when camera permissions are already granted.
const CardScannerCameraInner = forwardRef<
  CardScannerCameraViewRef,
  CardScannerCameraInnerProps
>(
  (
    {
      isActive = true,
      targetFps = 24,
      guideFrame: guideCfg = {},
      expectedSide,
      onPhotoCaptured,
      style,
      children,
      showGuide = true,
      onRetry,
      onAutoRetry,
    },
    ref
  ) => {
    console.log('rendering');
    const device = useCameraDevice('back');
    const format = useCameraFormat(device, [
      { fps: targetFps },
      { videoResolution: { width: 1920, height: 1080 } },
      { videoAspectRatio: SCREEN.height / SCREEN.width },
      { photoAspectRatio: SCREEN.height / SCREEN.width },
    ]);
    const cameraRef = useRef<Camera>(null);
    const [busy, setBusy] = useState(false);
    const captureLockRef = useRef(false);
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

    const [previewSize, setPreviewSize] = useState({
      width: SCREEN.width,
      height: SCREEN.height,
    });

    const onPreviewLayout = useCallback((e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setPreviewSize({ width, height });
    }, []);

    const overlayGuide = useMemo(
      () =>
        computeCardScannerGuideRectInPreview({
          previewWidth: previewSize.width,
          previewHeight: previewSize.height,
          widthFraction: guideCfg.widthFraction ?? DEFAULT_GUIDE.widthFraction,
          aspectRatio: guideCfg.aspectRatio ?? DEFAULT_GUIDE.aspectRatio,
        }),
      [
        previewSize.width,
        previewSize.height,
        guideCfg.widthFraction,
        guideCfg.aspectRatio,
      ]
    );

    const guideFrameStyle = useMemo(() => {
      if (overlayGuide.width > 0.5 && overlayGuide.height > 0.5) {
        return { width: overlayGuide.width, height: overlayGuide.height };
      }
      const wFrac = guideCfg.widthFraction ?? DEFAULT_GUIDE.widthFraction;
      const aspect = guideCfg.aspectRatio ?? DEFAULT_GUIDE.aspectRatio;
      const w = SCREEN.width * wFrac;
      return { width: w, height: w / aspect };
    }, [
      overlayGuide.height,
      overlayGuide.width,
      guideCfg.aspectRatio,
      guideCfg.widthFraction,
    ]);

    const holeMaskId = useId().replace(/:/g, '_');

    const figmaGuideOverlayGeom = useMemo(() => {
      const pw = previewSize.width;
      const ph = previewSize.height;
      const gw = guideFrameStyle.width;
      const gh = guideFrameStyle.height;
      if (pw < 2 || ph < 2 || gw < 2 || gh < 2) {
        return null;
      }
      const hx = (pw - gw) / 2;
      const hy = (ph - gh) / 2;
      const rx = Math.min(
        (FIGMA_HOLE_RX / FIGMA_GUIDE_W) * pw,
        gw * 0.5 - 0.5,
        gh * 0.5 - 0.5
      );
      const brLen = Math.min(28, Math.min(gw, gh) * 0.09);
      return { pw, ph, hx, hy, gw, gh, rx, brLen };
    }, [
      previewSize.height,
      previewSize.width,
      guideFrameStyle.height,
      guideFrameStyle.width,
    ]);

    const figmaBracketPaths = useMemo(() => {
      if (figmaGuideOverlayGeom == null) {
        return null;
      }
      const g = figmaGuideOverlayGeom;
      const { hx, hy, gw, gh, brLen } = g;
      const x1 = hx + gw;
      const y1 = hy + gh;
      const r = BRACKET_L_CORNER_RADIUS_PX;
      return {
        tl: lBracketPathRoundTopLeft(hx, hy, brLen, r),
        tr: lBracketPathRoundTopRight(x1, hy, brLen, r),
        bl: lBracketPathRoundBottomLeft(hx, y1, brLen, r),
        br: lBracketPathRoundBottomRight(x1, y1, brLen, r),
      };
    }, [figmaGuideOverlayGeom]);

    const takePhoto = useCallback(async (): Promise<string | null> => {
      if (!cameraRef.current || busy || captureLockRef.current) {
        return null;
      }
      captureLockRef.current = true;
      setBusy(true);
      try {
        const photo = await cameraRef.current.takePhoto({ flash: 'off' });
        const path = photo.path.startsWith('file://')
          ? photo.path
          : `file://${photo.path}`;

        const cropPlan = computePhotoRawCropRectForCardScan({
          previewSize,
          guideFrame: overlayGuide,
          photoWidth: photo.width,
          photoHeight: photo.height,
          photoOrientation: photo.orientation as Orientation,
          previewContentMode: 'cover',
        });

        const cropResult = await cropCardImageOnly({
          imagePath: path,
          crop: cropPlan.crop,
          cropCoordinateSpace: cropPlan.cropCoordinateSpace,
          bufferOrientation: cropPlan.bufferOrientation,
          sourcePhotoWidth: cropPlan.sourcePhotoWidth,
          sourcePhotoHeight: cropPlan.sourcePhotoHeight,
        });

        const scanResult = manualCropOnlyToScanResult(
          path,
          expectedSide,
          cropResult
        );
        const returnedPath = cropResult.croppedImagePath || path;

        // Callback is invoked; no local preview image state is set in the SDK component
        await onPhotoCaptured?.(returnedPath, scanResult);
        return returnedPath;
      } catch (e) {
        console.error(
          '[CardScannerCameraView] takePhoto manual crop error:',
          e
        );
        return null;
      } finally {
        captureLockRef.current = false;
        setBusy(false);
      }
    }, [busy, previewSize, overlayGuide, expectedSide, onPhotoCaptured]);

    const stop = useCallback(() => {
      // No-op (camera preview handled by app lifecycle/isActive prop)
    }, []);

    const start = useCallback(() => {
      captureLockRef.current = false;
      setBusy(false);
    }, []);

    const reset = useCallback(() => {
      captureLockRef.current = false;
      setBusy(false);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        takePhoto,
        stop,
        start,
        reset,
      }),
      [takePhoto, stop, start, reset]
    );

    if (device == null) {
      if (!isTimeout) {
        return (
          <View style={[styles.permissionPlaceholder, style]}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        );
      }
      return (
        <View style={[styles.permissionPlaceholder, style]}>
          <Text style={styles.permissionTitle}>Không tìm thấy camera.</Text>
          {onRetry && (
            <Pressable
              accessibilityRole="button"
              style={styles.permissionBtn}
              onPress={onRetry}
            >
              <Text style={styles.permissionBtnText}>Thử lại</Text>
            </Pressable>
          )}
          {children}
        </View>
      );
    }

    return (
      <View style={[styles.root, style]}>
        <View style={styles.preview} onLayout={onPreviewLayout}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            format={format}
            isActive={isActive}
            outputOrientation="preview"
            photo
            fps={targetFps}
            resizeMode="cover"
            enableZoomGesture={false}
          />

          {showGuide && figmaGuideOverlayGeom && figmaBracketPaths && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg
                width={previewSize.width}
                height={previewSize.height}
                style={StyleSheet.absoluteFill}
              >
                <Defs>
                  <Mask id={holeMaskId}>
                    <SvgRect
                      x={0}
                      y={0}
                      width={previewSize.width}
                      height={previewSize.height}
                      fill="#ffffff"
                    />
                    <SvgRect
                      x={figmaGuideOverlayGeom.hx}
                      y={figmaGuideOverlayGeom.hy}
                      width={figmaGuideOverlayGeom.gw}
                      height={figmaGuideOverlayGeom.gh}
                      rx={figmaGuideOverlayGeom.rx}
                      ry={figmaGuideOverlayGeom.rx}
                      fill="#000000"
                    />
                  </Mask>
                </Defs>

                <SvgRect
                  x={0}
                  y={0}
                  width={previewSize.width}
                  height={previewSize.height}
                  fill="rgba(0, 0, 0, 0.65)"
                  mask={`url(#${holeMaskId})`}
                />

                <Path
                  d={figmaBracketPaths.tl}
                  stroke="#ffffff"
                  strokeWidth={3}
                  fill="none"
                />
                <Path
                  d={figmaBracketPaths.tr}
                  stroke="#ffffff"
                  strokeWidth={3}
                  fill="none"
                />
                <Path
                  d={figmaBracketPaths.bl}
                  stroke="#ffffff"
                  strokeWidth={3}
                  fill="none"
                />
                <Path
                  d={figmaBracketPaths.br}
                  stroke="#ffffff"
                  strokeWidth={3}
                  fill="none"
                />
              </Svg>
            </View>
          )}

          {busy && (
            <View style={styles.busyOverlay}>
              <ActivityIndicator color="#ffffff" size="large" />
            </View>
          )}

          {children}
        </View>
      </View>
    );
  }
);

// Wrapper component that checks permissions first and only mounts CardScannerCameraInner when permissions are granted
export const CardScannerCameraView = forwardRef<
  CardScannerCameraViewRef,
  CardScannerCameraViewProps
>((props, ref) => {
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
      !props.isActive ||
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
  }, [hasPermission, props.isActive, requestPermission]);

  if (!hasPermission) {
    return (
      <View style={[styles.permissionPlaceholder, props.style]}>
        <Text style={styles.permissionTitle}>Cần quyền camera</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.permissionBtn}
          onPress={handleRequestCameraPermission}
        >
          <Text style={styles.permissionBtnText}>Cấp quyền</Text>
        </Pressable>
        {props.children}
      </View>
    );
  }

  // Once permission is granted, mount the camera inner component with key to allow remounting
  return (
    <CardScannerCameraInner
      ref={ref}
      key={refreshKey}
      onRetry={handleRetry}
      onAutoRetry={handleAutoRetry}
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  preview: {
    flex: 1,
    position: 'relative',
  },
  permissionPlaceholder: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
