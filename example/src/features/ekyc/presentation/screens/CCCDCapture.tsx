import { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
  StatusBar,
  SafeAreaView,
  Alert,
  Image,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  CardScannerCameraView,
  type CardScannerCameraViewRef,
  type ScanCardResult,
  type ScanFrameResult,
} from '@xungchan/ekyc-core';
import { useIsFocused } from '@react-navigation/native';
import { useEkycVM } from '../viewmodels/cccdCaptureVM';

export default function CCCDCapture() {
  const isFocused = useIsFocused();
  const cardCameraRef = useRef<CardScannerCameraViewRef>(null);
  const { setFrontImage, setBackImage, navigateToPreview } = useEkycVM();

  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front');
  const [isBusy, setIsBusy] = useState(false);
  const [isAuto, setIsAuto] = useState(true);
  const [hintLock, setHintLock] = useState(false);
  const [validationHint, setValidationHint] = useState<{
    text: string;
    type: 'neutral' | 'warning' | 'success';
  }>({ text: 'Đặt giấy tờ vào khung hình', type: 'neutral' });
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [retakeLock, setRetakeLock] = useState(false);

  const handleFrameValidated = (result: ScanFrameResult) => {
    if (hintLock) return;

    if (!result.isDocumentPresent) {
      setValidationHint({
        text: result.errorMessage || 'Đặt giấy tờ vào khung hình',
        type: 'neutral',
      });
    } else if (result.errorCode) {
      setValidationHint({
        text: result.errorMessage || 'Chất lượng hình ảnh không đạt yêu cầu',
        type: 'warning',
      });
    } else {
      setValidationHint({
        text: 'Giữ nguyên để tự động chụp...',
        type: 'success',
      });
    }
  };

  const handlePhotoCaptured = (path: string, scanResult: ScanCardResult) => {
    console.log('[CCCDCapture] Captured photo:', path, scanResult);
    if (!scanResult.success) {
      setHintLock(true);
      setValidationHint({
        text:
          scanResult.errorMessage ||
          'Nhận diện thất bại. Vui lòng chụp lại rõ nét hơn.',
        type: 'warning',
      });
      setTimeout(() => {
        setHintLock(false);
        setValidationHint({
          text:
            currentSide === 'front'
              ? 'Đặt giấy tờ vào khung hình'
              : 'Đặt mặt sau giấy tờ vào khung hình',
          type: 'neutral',
        });
        cardCameraRef.current?.reset();
        cardCameraRef.current?.start();
      }, 3000);
      return;
    }

    setPreviewPath(scanResult.croppedImagePath || path);
    console.log('path', path);
    console.log('preview', scanResult.croppedImagePath || path);
    setHintLock(true);
    setValidationHint({
      text: `Kiểm tra ảnh chụp mặt ${currentSide === 'front' ? 'trước' : 'sau'}`,
      type: 'neutral',
    });
  };

  const handleRetake = () => {
    setPreviewPath(null);
    setRetakeLock(true);
    setHintLock(false);
    setValidationHint({
      text:
        currentSide === 'front'
          ? 'Đặt giấy tờ vào khung hình'
          : 'Đặt mặt sau giấy tờ vào khung hình',
      type: 'neutral',
    });
    cardCameraRef.current?.reset();
    cardCameraRef.current?.start();
    setTimeout(() => {
      setRetakeLock(false);
    }, 1500);
  };

  const handleConfirm = () => {
    if (!previewPath) return;

    if (currentSide === 'front') {
      setFrontImage(previewPath);
      setPreviewPath(null);
      setCurrentSide('back');
      setHintLock(false);
      setValidationHint({
        text: 'Đặt mặt sau giấy tờ vào khung hình',
        type: 'neutral',
      });
      cardCameraRef.current?.reset();
      cardCameraRef.current?.start();
    } else {
      setBackImage(previewPath);
      setPreviewPath(null);
      navigateToPreview();
    }
  };

  const handleShutterPress = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const path = await cardCameraRef.current?.takePhoto();
      if (!path) {
        console.log('[CCCDCapture] Shutter failed to return path');
      }
    } catch (e) {
      console.error('[CCCDCapture] Take photo error:', e);
    } finally {
      setIsBusy(false);
    }
  };

  const instructionText =
    currentSide === 'front'
      ? 'Chụp ảnh mặt trước giấy tờ'
      : 'Chụp ảnh mặt sau giấy tờ';

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <View
          style={[
            StyleSheet.absoluteFill,
            previewPath ? styles.cameraHidden : styles.cameraVisible,
          ]}
        >
          <CardScannerCameraView
            ref={cardCameraRef}
            style={StyleSheet.absoluteFill}
            isActive={isFocused && !previewPath}
            expectedSide={currentSide}
            onPhotoCaptured={handlePhotoCaptured}
            autocapture={isAuto && !retakeLock}
            onFrameValidated={
              isAuto && !retakeLock ? handleFrameValidated : undefined
            }
          />
        </View>
        {previewPath && (
          <Image
            source={{ uri: previewPath }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
        )}
      </View>

      {/* Header Overlay */}
      <SafeAreaView style={styles.headerContainer}>
        <View style={styles.headerToolbar}>
          <View style={styles.backButton} />

          <Text style={styles.headerTitle}>Xác thực eKYC</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
      </SafeAreaView>

      {/* HUD overlays */}
      <View style={styles.hudContainer} pointerEvents="box-none">
        {/* Instruction & Validation Hints */}
        <View style={styles.hintsWrapper}>
          <View style={styles.instructionBanner}>
            <Text style={styles.instructionText}>
              {previewPath
                ? `Xem lại ảnh chụp mặt ${currentSide === 'front' ? 'trước' : 'sau'}`
                : instructionText}
            </Text>
          </View>

          <View
            style={[
              styles.validationBubble,
              !previewPath &&
                (isBusy
                  ? 'neutral'
                  : isAuto
                    ? validationHint.type
                    : 'neutral') === 'warning' &&
                styles.validationBubbleWarning,
              !previewPath &&
                (isBusy
                  ? 'neutral'
                  : isAuto
                    ? validationHint.type
                    : 'neutral') === 'success' &&
                styles.validationBubbleSuccess,
            ]}
          >
            {!previewPath && (
              <View
                style={[
                  styles.validationIndicator,
                  (isBusy
                    ? 'neutral'
                    : isAuto
                      ? validationHint.type
                      : 'neutral') === 'warning' &&
                    styles.validationIndicatorWarning,
                  (isBusy
                    ? 'neutral'
                    : isAuto
                      ? validationHint.type
                      : 'neutral') === 'success' &&
                    styles.validationIndicatorSuccess,
                ]}
              />
            )}
            <Text style={styles.validationText}>
              {previewPath
                ? 'Vui lòng kiểm tra thông tin rõ nét, không mờ nhòe, lóa sáng.'
                : isBusy
                  ? 'Đang xử lý...'
                  : isAuto
                    ? validationHint.text
                    : 'Đặt giấy tờ vào khung hình và nhấn nút chụp'}
            </Text>
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection} pointerEvents="box-none">
          {previewPath ? (
            <View style={styles.previewButtonsContainer}>
              <Pressable
                accessibilityRole="button"
                style={styles.retakeButton}
                onPress={handleRetake}
              >
                <Text style={styles.retakeButtonText}>Chụp lại</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.confirmButton}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>Lấy ảnh này</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Capture Mode Toggle Switch */}
              <View style={styles.toggleContainer}>
                <Pressable
                  style={[
                    styles.toggleButton,
                    isAuto && styles.toggleButtonActive,
                  ]}
                  onPress={() => {
                    setIsAuto(true);
                    setValidationHint({
                      text: 'Đặt giấy tờ vào khung hình',
                      type: 'neutral',
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      isAuto && styles.toggleTextActive,
                    ]}
                  >
                    Tự động
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.toggleButton,
                    !isAuto && styles.toggleButtonActive,
                  ]}
                  onPress={() => {
                    setIsAuto(false);
                    setValidationHint({
                      text: 'Đặt giấy tờ vào khung hình',
                      type: 'neutral',
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      !isAuto && styles.toggleTextActive,
                    ]}
                  >
                    Thủ công
                  </Text>
                </Pressable>
              </View>

              {/* Guideline */}
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    'Hướng dẫn',
                    'Đặt giấy tờ tuỳ thân (CCCD/CMND) vuông góc vào trong khung hình. Đảm bảo ảnh rõ nét, không mờ, không lóa.'
                  )
                }
                style={styles.guidelineButton}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Circle
                    cx={12}
                    cy={12}
                    r={10}
                    stroke="#f8fafc"
                    strokeWidth={2}
                  />
                  <Path
                    d="M12 16v-4"
                    stroke="#f8fafc"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                  <Circle cx={12} cy={8} r={1.25} fill="#f8fafc" />
                </Svg>
                <Text style={styles.guidelineText}>Xem hướng dẫn</Text>
              </Pressable>

              {/* Shutter Button */}
              <View style={styles.shutterContainer}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleShutterPress}
                  style={({ pressed }) => [
                    styles.shutterOuter,
                    pressed && styles.shutterOuterPressed,
                  ]}
                >
                  <View style={styles.shutterInner} />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111820',
  },
  cameraContainer: {
    flex: 1,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerToolbar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  hudContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 40,
  },
  instructionBanner: {
    alignSelf: 'center',
    backgroundColor: 'rgba(51, 51, 51, 0.75)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 1000,
    maxWidth: '85%',
  },
  instructionText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '400',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  bottomSection: {
    alignItems: 'center',
  },
  guidelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 24,
  },
  guidelineText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  shutterContainer: {
    height: 84,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterOuterPressed: {
    transform: [{ scale: 0.95 }],
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  shutterInner: {
    flex: 1,
    width: '100%',
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  hintsWrapper: {
    alignSelf: 'center',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  validationBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxWidth: '85%',
    gap: 8,
  },
  validationBubbleWarning: {
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    borderColor: 'rgba(234, 88, 12, 0.3)',
  },
  validationBubbleSuccess: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    borderColor: 'rgba(22, 163, 74, 0.3)',
  },
  validationIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
  },
  validationIndicatorWarning: {
    backgroundColor: '#ea580c',
  },
  validationIndicatorSuccess: {
    backgroundColor: '#16a34a',
  },
  validationText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignSelf: 'center',
    marginBottom: 16,
    width: 180,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 20,
  },
  toggleButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'Inter',
  },
  toggleTextActive: {
    color: '#0f172a',
  },
  previewButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
    width: '100%',
    marginBottom: 16,
  },
  retakeButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  confirmButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  cameraHidden: {
    opacity: 0,
  },
  cameraVisible: {
    opacity: 1,
  },
});
