import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CARD_SCANNER_DEFAULT_THROTTLE_MS,
  CARD_SCANNER_DEFAULT_BLUR_THRESHOLD,
  CARD_SCANNER_DEFAULT_GLARE_THRESHOLD,
  EVENTS_NAME,
} from '../constants';
import { NativeEventEmitter, NativeModules } from 'react-native';
import {
  Camera,
  runAsync,
  useFrameProcessor,
  type Orientation,
} from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';

import { cropCardImageOnly } from '../modules/cardScanner';
import {
  computePhotoRawCropRectForCardScan,
  type ManualPhotoCropPlan,
  type Rect,
} from '../modules/photoGuideCropRect';
import { scanCardFrame, type ScanFrameResult } from '../modules/scanCardFrame';
import type { ScanCardResult, CardCapturedEvent } from '../types';
import { manualCropOnlyToScanResult } from '../utils/cardScannerHelpers';

const cardScannerEmitter = new NativeEventEmitter(NativeModules.CardScanner);

export function useCardScannerCapture({
  cameraRef,
  previewSize,
  overlayGuide,
  expectedSide,
  autocapture,
  isActive,
  onPhotoCaptured,
  onFrameValidated,
}: {
  cameraRef: React.RefObject<Camera | null>;
  previewSize: { width: number; height: number };
  overlayGuide: Rect;
  expectedSide?: 'front' | 'back';
  autocapture: boolean;
  isActive: boolean;
  onPhotoCaptured?: (imagePath: string, scanResult: ScanCardResult) => void;
  onFrameValidated?: (result: ScanFrameResult) => void;
}) {
  const [busy, setBusy] = useState(false);
  const captureLockRef = useRef(false);
  const [isDocDetected, setIsDocDetected] = useState(false);
  const lastValidationStateRef = useRef<{ isDoc: boolean; errCode: string }>({
    isDoc: false,
    errCode: '',
  });

  const onFrameValidatedJS = useRunOnJS(
    (isDocumentPresent: boolean, errorCode: string, errorMessage: string) => {
      if (
        lastValidationStateRef.current.isDoc !== isDocumentPresent ||
        lastValidationStateRef.current.errCode !== errorCode
      ) {
        lastValidationStateRef.current = {
          isDoc: isDocumentPresent,
          errCode: errorCode,
        };
        setIsDocDetected(isDocumentPresent);
        if (onFrameValidated) {
          onFrameValidated({ isDocumentPresent, errorCode, errorMessage });
        }
      }
    },
    [onFrameValidated]
  );

  useEffect(() => {
    if (!autocapture || !isActive) {
      setIsDocDetected(false);
      return undefined;
    }

    const subscriptionCapture = cardScannerEmitter.addListener(
      EVENTS_NAME.CARD_CAPTURED,
      async (event: CardCapturedEvent) => {
        if (busy || captureLockRef.current) return;

        if (event.success) {
          captureLockRef.current = true;
          setBusy(true);
          const scanResult: ScanCardResult = {
            success: true,
            originalImagePath: event.croppedImagePath,
            croppedImagePath: event.croppedImagePath,
            side: event.side || expectedSide || 'unknown',
            sideFrontScore: event.sideFrontScore,
            sideBackScore: event.sideBackScore,
            quality: {
              passed: true,
              blurScore: event.blurScore,
              motionScore: 0.0,
              glareScore: event.glarePercent * 100,
              exposure: 'ok',
              reasons: [],
            },
            appliedCrop: {
              x: event.appliedCrop.x,
              y: event.appliedCrop.y,
              width: event.appliedCrop.width,
              height: event.appliedCrop.height,
            },
            manualCaptureDebugSavedToGallery: false,
          };
          onPhotoCaptured?.(event.croppedImagePath, scanResult);
          captureLockRef.current = false;
          setBusy(false);
        } else {
          captureLockRef.current = true;
          setBusy(true);
          const scanResult: ScanCardResult = {
            success: false,
            originalImagePath: '',
            side: expectedSide ?? 'unknown',
            sideFrontScore: 0,
            sideBackScore: 0,
            quality: {
              passed: false,
              blurScore: 0.0,
              motionScore: 0.0,
              glareScore: 0.0,
              exposure: 'ok',
              reasons: [event.errorCode ?? 'QUALITY_FAILED'],
            },
            manualCaptureDebugSavedToGallery: false,
            errorCode: event.errorCode,
            errorMessage: event.errorMessage,
          };
          await onPhotoCaptured?.('', scanResult);
          captureLockRef.current = false;
          setBusy(false);
        }
      }
    );

    return () => {
      subscriptionCapture.remove();
    };
  }, [autocapture, isActive, expectedSide, onPhotoCaptured, busy]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (busy || captureLockRef.current) {
        return;
      }
      runAsync(frame, () => {
        'worklet';
        const result = scanCardFrame(frame, {
          previewWidth: previewSize.width,
          previewHeight: previewSize.height,
          guideX: overlayGuide.x,
          guideY: overlayGuide.y,
          guideWidth: overlayGuide.width,
          guideHeight: overlayGuide.height,
          bufferOrientation: frame.orientation,
          throttleMs: CARD_SCANNER_DEFAULT_THROTTLE_MS,
          blurThreshold: CARD_SCANNER_DEFAULT_BLUR_THRESHOLD,
          glareThreshold: CARD_SCANNER_DEFAULT_GLARE_THRESHOLD,
          expectedSide: expectedSide,
        });

        if (result) {
          onFrameValidatedJS(
            result.isDocumentPresent,
            result.errorCode,
            result.errorMessage
          );
        }
      });
    },
    [previewSize, overlayGuide, busy, onFrameValidatedJS, expectedSide]
  );

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

      const cropPlan: ManualPhotoCropPlan = computePhotoRawCropRectForCardScan({
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
        manualCaptureDebugSaveToGallery: true,
        expectedSide: expectedSide,
      });

      const scanResult = manualCropOnlyToScanResult(
        path,
        expectedSide,
        cropResult
      );
      const returnedPath = cropResult.croppedImagePath || path;

      onPhotoCaptured?.(returnedPath, scanResult);
      return returnedPath;
    } catch (e) {
      console.error('[CardScannerCameraView] takePhoto manual crop error:', e);
      return null;
    } finally {
      captureLockRef.current = false;
      setBusy(false);
    }
  }, [
    busy,
    previewSize,
    overlayGuide,
    expectedSide,
    onPhotoCaptured,
    cameraRef,
  ]);

  const start = useCallback(() => {
    captureLockRef.current = false;
    lastValidationStateRef.current = { isDoc: false, errCode: '' };
    setBusy(false);
    setIsDocDetected(false);
  }, []);

  const reset = useCallback(() => {
    captureLockRef.current = false;
    lastValidationStateRef.current = { isDoc: false, errCode: '' };
    setBusy(false);
    setIsDocDetected(false);
  }, []);
  const stop = useCallback(() => {
    // No-op (camera preview handled by app lifecycle/isActive prop)
  }, []);
  return {
    busy,
    isDocDetected,
    frameProcessor,
    takePhoto,
    start,
    reset,
    stop,
  };
}
