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
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  CardScannerCameraView,
  type CardScannerCameraViewRef,
  type ScanCardResult,
} from '@xungchan/ekyc-core';
import type { ScreenProps } from '../../../../navagation/AppNavigator';

export default function CCCDCapture({ navigation }: ScreenProps) {
  const cardCameraRef = useRef<CardScannerCameraViewRef>(null);

  const [frontImagePath, setFrontImagePath] = useState<string | null>(null);
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front');
  const [isBusy, setIsBusy] = useState(false);

  const handlePhotoCaptured = (path: string, scanResult: ScanCardResult) => {
    console.log('[CCCDCapture] Captured photo:', path, scanResult);
    if (!scanResult.success) {
      Alert.alert(
        'Lỗi',
        'Không thể nhận diện được giấy tờ. Vui lòng chụp lại rõ nét hơn.'
      );
      return;
    }

    if (currentSide === 'front') {
      setFrontImagePath(path);
      setCurrentSide('back');
    } else {
      const frontPath = frontImagePath;
      const backPath = path;

      // Reset state for next time
      setFrontImagePath(null);
      setCurrentSide('front');

      // Navigate to preview
      navigation.navigate('CCCDCapturePreview', {
        frontImagePath: frontPath,
        backImagePath: backPath,
      });
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
        <CardScannerCameraView
          ref={cardCameraRef}
          style={StyleSheet.absoluteFill}
          isActive={true}
          expectedSide={currentSide}
          onPhotoCaptured={handlePhotoCaptured}
        />
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
        {/* Instruction Banner */}
        <View style={styles.instructionBanner}>
          <Text style={styles.instructionText}>{instructionText}</Text>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection} pointerEvents="box-none">
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
              <Circle cx={12} cy={12} r={10} stroke="#f8fafc" strokeWidth={2} />
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
});
