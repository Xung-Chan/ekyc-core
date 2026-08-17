import {
  forwardRef,
  useCallback,
  useEffect,
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
  type ViewStyle,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import { finalizeFromPath } from '../modules/facePortrait';
import type {
  FacePortraitCameraConfig,
  FacePortraitCameraViewProps,
  FacePortraitCameraViewRef,
  FacePortraitCaptureEvent,
} from '../type';

const SCREEN = Dimensions.get('window');

const CONFIG_BASE: Required<
  Pick<
    FacePortraitCameraConfig,
    | 'guideWidthFraction'
    | 'guideAspectRatio'
    | 'guideCenterYFraction'
    | 'faceCropHeightExpansion'
    | 'faceTargetFillMin'
    | 'faceTargetFillMax'
    | 'guideFaceContainmentPaddingFraction'
    | 'frameThrottleMs'
    | 'autoCaptureStableFrameCount'
    | 'glareMeanLumaThreshold'
    | 'verifyFaceOnStill'
    | 'requireEyesOpen'
    | 'eyeOpenProbabilityMin'
    | 'eyeOpenLandmarkRatioMin'
  >
> = {
  guideWidthFraction: 0.72,
  guideAspectRatio: 0.7,
  guideCenterYFraction: 0.42,
  faceCropHeightExpansion: 0.45,
  faceTargetFillMin: 0.5,
  faceTargetFillMax: 0.9,
  guideFaceContainmentPaddingFraction: 0.08,
  frameThrottleMs: 90,
  autoCaptureStableFrameCount: 4,
  glareMeanLumaThreshold: 232,
  verifyFaceOnStill: false,
  requireEyesOpen: true,
  eyeOpenProbabilityMin: 0.12,
  eyeOpenLandmarkRatioMin: 0.1,
};

function normalizeFileUrl(p: string): string {
  const t = p.trim();
  if (!t) {
    return t;
  }
  return t.startsWith('file://') ? t : `file://${t}`;
}

export const FacePortraitCameraView = forwardRef<
  FacePortraitCameraViewRef,
  FacePortraitCameraViewProps
>(
  (
    {
      autoCapture,
      isActive = true,
      targetFps = 24,
      cameraFacing = 'front',
      guideFrame: guideCfg = {},
      config: userConfig = {},
      onFacePortraitCapture,
      onPhotoCaptured,
      showFaceDetectionBox = true,
      style,
      children,
    },
    ref
  ) => {
    const device = useCameraDevice(cameraFacing === 'back' ? 'back' : 'front');
    /** Preview nét: video stream độ phân giải cao */
    const format = useCameraFormat(device, [
      { videoResolution: 'max' },
      { fps: targetFps },
    ]);
    const { hasPermission, requestPermission } = useCameraPermission();

    const openCameraPermissionSettings = useCallback(async () => {
      try {
        await Linking.openSettings();
      } catch {
        // no-op — host may block deep link to settings
      }
    }, []);

    /** Xin quyền camera; nếu đã / vừa bị denied hoặc restricted → mở Cài đặt. */
    const handleRequestCameraPermission = useCallback(async () => {
      const before = Camera.getCameraPermissionStatus();
      if (before === 'denied' || before === 'restricted') {
        await openCameraPermissionSettings();
        return;
      }

      const granted = await requestPermission();
      if (granted) {
        return;
      }

      const after = Camera.getCameraPermissionStatus();
      if (after === 'denied' || after === 'restricted') {
        await openCameraPermissionSettings();
      }
    }, [openCameraPermissionSettings, requestPermission]);

    const didAutoRequestCameraPermissionRef = useRef(false);

    /** Lần đầu vào màn (chưa hỏi quyền) — hiện dialog hệ thống; không auto-xin khi denied/restricted. */
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

    const cameraRef = useRef<Camera>(null);
    const [busy, setBusy] = useState(false);
    /** Sau chụp thành công: tắt camera session cho đến khi `start()` / `reset()`. */
    const [stoppedAfterCapture, setStoppedAfterCapture] = useState(false);
    const captureLockRef = useRef(false);

    const effectiveIsActive = isActive && !stoppedAfterCapture;

    const nativeConfig = useMemo(
      (): FacePortraitCameraConfig => ({
        ...CONFIG_BASE,
        ...userConfig,
        autoCapture,
        guideWidthFraction:
          guideCfg.widthFraction ??
          userConfig.guideWidthFraction ??
          CONFIG_BASE.guideWidthFraction,
        guideAspectRatio:
          guideCfg.aspectRatio ??
          userConfig.guideAspectRatio ??
          CONFIG_BASE.guideAspectRatio,
        guideCenterYFraction:
          guideCfg.centerYFraction ??
          userConfig.guideCenterYFraction ??
          CONFIG_BASE.guideCenterYFraction,
      }),
      [autoCapture, guideCfg, userConfig]
    );

    const emitCapture = useCallback(
      async (payload: FacePortraitCaptureEvent) => {
        onFacePortraitCapture?.({ nativeEvent: payload });
      },
      [onFacePortraitCapture]
    );

    const runFinalize = useCallback(
      async (pathRaw: string): Promise<FacePortraitCaptureEvent> => {
        const path = normalizeFileUrl(pathRaw);
        try {
          const r = await finalizeFromPath({
            imagePath: path,
            config: nativeConfig,
          } as any);
          if (r.success) {
            return {
              success: true,
              fullImagePath: r.fullImagePath,
              faceCropPath: r.faceCropPath,
            };
          }
          return {
            success: false,
            error: r.error ?? 'finalize_failed',
          };
        } catch (e) {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
      [nativeConfig]
    );

    const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
    const onPreviewLayout = useCallback((e: any) => {
      const { width, height } = e.nativeEvent.layout;
      setPreviewSize({ width, height });
    }, []);

    const onGuideLayout = useCallback(() => {
      // no-op
    }, []);

    const reset = useCallback(() => {
      setStoppedAfterCapture(false);
    }, []);

    const detectionState = useMemo(() => ({
      faceRectView: null as { x: number; y: number; width: number; height: number } | null,
    }), []);

    const guideStyle = useMemo((): ViewStyle => {
      const wFrac =
        guideCfg.widthFraction ??
        userConfig.guideWidthFraction ??
        CONFIG_BASE.guideWidthFraction;
      const aspect =
        guideCfg.aspectRatio ??
        userConfig.guideAspectRatio ??
        CONFIG_BASE.guideAspectRatio;
      const centerY =
        guideCfg.centerYFraction ??
        userConfig.guideCenterYFraction ??
        CONFIG_BASE.guideCenterYFraction;

      if (previewSize.width <= 0 || previewSize.height <= 0) {
        return {
          position: 'absolute',
          left: (SCREEN.width * (1 - wFrac)) / 2,
          top: 120,
          width: SCREEN.width * wFrac,
          height: (SCREEN.width * wFrac) / aspect,
          opacity: 0,
        };
      }

      const gw = previewSize.width * wFrac;
      const gh = gw / aspect;
      return {
        position: 'absolute',
        left: (previewSize.width - gw) / 2,
        top: previewSize.height * centerY - gh / 2,
        width: gw,
        height: gh,
      };
    }, [
      guideCfg.aspectRatio,
      guideCfg.centerYFraction,
      guideCfg.widthFraction,
      previewSize.height,
      previewSize.width,
      userConfig.guideAspectRatio,
      userConfig.guideCenterYFraction,
      userConfig.guideWidthFraction,
    ]);

    const takePhoto = useCallback(async (): Promise<string | null> => {
      if (!cameraRef.current || busy || stoppedAfterCapture) {
        return null;
      }
      captureLockRef.current = true;
      setBusy(true);
      try {
        const photo = await cameraRef.current.takePhoto({ flash: 'off' });
        const path = photo.path.startsWith('file://')
          ? photo.path
          : `file://${photo.path}`;
        const ev = await runFinalize(path);
        await emitCapture(ev);
        if (ev.success) {
          setStoppedAfterCapture(true);
        }
        await onPhotoCaptured?.(path);
        return path;
      } catch (e) {
        await emitCapture({
          success: false,
          error:
            e instanceof Error ? e.message : String(e ?? 'take_photo_failed'),
        });
        return null;
      } finally {
        captureLockRef.current = false;
        setBusy(false);
      }
    }, [
      busy,
      emitCapture,
      onPhotoCaptured,
      runFinalize,
      stoppedAfterCapture,
    ]);

    const startSession = useCallback(() => {
      setStoppedAfterCapture(false);
      reset();
      captureLockRef.current = false;
    }, [reset]);

    useImperativeHandle(
      ref,
      () => ({
        takePhoto,
        start: startSession,
        reset: startSession,
      }),
      [startSession, takePhoto]
    );

    if (!hasPermission) {
      return (
        <View style={[styles.permissionPlaceholder, style]}>
          <Text style={styles.permissionTitle}>Cần quyền camera</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.permissionBtn}
            onPress={handleRequestCameraPermission}
          >
            <Text style={styles.permissionBtnText}>Cấp quyền</Text>
          </Pressable>
          {children}
        </View>
      );
    }

    if (device == null) {
      return (
        <View style={[styles.permissionPlaceholder, style]}>
          <Text style={styles.permissionTitle}>Không tìm thấy camera.</Text>
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
            isActive={effectiveIsActive}
            outputOrientation="preview"
            photo
            fps={targetFps}
            pixelFormat="yuv"
            resizeMode="cover"
            enableZoomGesture={false}
          />
          {showFaceDetectionBox &&
          !busy &&
          detectionState.faceRectView &&
          (detectionState.faceRectView as any).width > 0 &&
          (detectionState.faceRectView as any).height > 0 &&
          previewSize.width > 0 &&
          previewSize.height > 0 ? (
            <View
              pointerEvents="none"
              style={[
                styles.faceDetectionBox,
                {
                  left: (detectionState.faceRectView as any).x * previewSize.width,
                  top: (detectionState.faceRectView as any).y * previewSize.height,
                  width: (detectionState.faceRectView as any).width * previewSize.width,
                  height:
                    (detectionState.faceRectView as any).height * previewSize.height,
                },
              ]}
            />
          ) : null}
          <View style={styles.guideMeasureWrap} pointerEvents="box-none">
            <View style={guideStyle} onLayout={onGuideLayout} />
          </View>
          {busy ? (
            <View style={styles.busyOverlay} pointerEvents="none">
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </View>
        {children}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  preview: {
    flex: 1,
  },
  guideMeasureWrap: {
    ...StyleSheet.absoluteFill,
  },
  permissionPlaceholder: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  permissionBtnText: { color: '#111', fontWeight: '600' },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  faceDetectionBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#4ade80',
    backgroundColor: 'rgba(74,222,128,0.12)',
  },
});
