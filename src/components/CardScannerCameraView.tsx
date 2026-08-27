import React, { forwardRef, useId, useImperativeHandle, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, Mask, Path, Rect as SvgRect } from 'react-native-svg';
import { Camera } from 'react-native-vision-camera';

import { useCardScannerCameraDevice } from '../hooks/useCardScannerCameraDevice';
import { useCardScannerCapture } from '../hooks/useCardScannerCapture';
import { useCardScannerGuideLayout } from '../hooks/useCardScannerGuideLayout';
import { useInitCardScannerCameraView } from '../hooks/useInitCardScannerCameraView';
import { type ScanFrameResult } from '../modules/scanCardFrame';
import type { ScanCardResult } from '../types';

const DEFAULT_GUIDE = {
  widthFraction: 0.86,
  aspectRatio: 1.586,
};

// Helper functions moved to cardScannerHelpers.ts

export type CardScannerCameraViewGuideConfig = {
  widthFraction?: number;
  aspectRatio?: number;
};

export interface CardScannerCameraViewProps {
  isActive?: boolean;
  autocapture?: boolean;
  targetFps?: number;
  guideFrame?: CardScannerCameraViewGuideConfig;
  expectedSide?: 'front' | 'back';
  style?: ViewStyle;
  showGuide?: boolean;
  children?: React.ReactNode;
  onPhotoCaptured?: (imagePath: string, scanResult: ScanCardResult) => void;
  onFrameValidated?: (result: ScanFrameResult) => void;
}
export interface CardScannerCameraInnerProps extends CardScannerCameraViewProps {
  onRetry: () => void;
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
      autocapture = false,
      targetFps = 24,
      guideFrame: guideCfg = DEFAULT_GUIDE,
      expectedSide,
      style,
      children,
      showGuide = true,
      onPhotoCaptured,
      onRetry,
      onAutoRetry,
      onFrameValidated,
    },
    ref
  ) => {
    console.log('rendering');
    const cameraRef = useRef<Camera>(null);

    const { device, format, isTimeout } = useCardScannerCameraDevice(
      targetFps,
      onAutoRetry
    );

    const {
      previewSize,
      onPreviewLayout,
      overlayGuide,
      figmaGuideOverlayGeom,
      figmaBracketPaths,
    } = useCardScannerGuideLayout(guideCfg);

    const {
      busy,
      isDocDetected,
      frameProcessor,
      takePhoto,
      start,
      reset,
      stop,
    } = useCardScannerCapture({
      cameraRef,
      previewSize,
      overlayGuide,
      expectedSide,
      autocapture,
      isActive,
      onPhotoCaptured,
      onFrameValidated,
    });

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

    const holeMaskId = useId().replace(/:/g, '_');

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

    const strokeColor = isDocDetected ? '#4CD964' : '#ffffff';

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
            frameProcessor={autocapture ? frameProcessor : undefined}
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
                  stroke={strokeColor}
                  strokeWidth={3}
                  fill="none"
                />
                <Path
                  d={figmaBracketPaths.tr}
                  stroke={strokeColor}
                  strokeWidth={3}
                  fill="none"
                />
                <Path
                  d={figmaBracketPaths.bl}
                  stroke={strokeColor}
                  strokeWidth={3}
                  fill="none"
                />
                <Path
                  d={figmaBracketPaths.br}
                  stroke={strokeColor}
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
  const {
    hasPermission,
    handleRequestCameraPermission,
    handleRetry,
    handleAutoRetry,
    refreshKey,
  } = useInitCardScannerCameraView(props.isActive);
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
