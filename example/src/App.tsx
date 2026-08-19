import {
  FacePortraitCameraView,
  type FacePortraitCameraViewRef,
  CardScannerCameraView,
  type CardScannerCameraViewRef,
  type ScanCardResult,
} from '@xungchan/ekyc-core';
import { useRef, useState } from 'react';
import {
  Button,
  StyleSheet,
  View,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';

export default function App() {
  const [mode, setMode] = useState<'face' | 'card'>('card');
  const faceCameraRef = useRef<FacePortraitCameraViewRef>(null);
  const cardCameraRef = useRef<CardScannerCameraViewRef>(null);

  const onFaceCapture = (res: any) => {
    console.log('[App] face portrait capture result:', res);
    Alert.alert('Face Capture Result', JSON.stringify(res, null, 2));
  };

  const onCardPhotoCaptured = (path: string, scanResult: ScanCardResult) => {
    console.log('[App] card photo captured:', path, scanResult);
    Alert.alert(
      'Card Photo Captured',
      `Success: ${scanResult.success}\nOriginal Path: ${scanResult.originalImagePath}\nCropped Path: ${scanResult.croppedImagePath}`
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <View style={styles.tabButton}>
          <Button
            title="Face Scanner"
            color={mode === 'face' ? '#007AFF' : '#8E8E93'}
            onPress={() => setMode('face')}
          />
        </View>
        <View style={styles.tabButton}>
          <Button
            title="Card Scanner"
            color={mode === 'card' ? '#007AFF' : '#8E8E93'}
            onPress={() => setMode('card')}
          />
        </View>
      </View>

      <View style={styles.cameraContainer}>
        {mode === 'face' ? (
          <FacePortraitCameraView
            ref={faceCameraRef}
            style={styles.fullBleed}
            autoCapture={true}
            isActive={true}
            showFaceDetectionBox={true}
            config={{ verifyFaceOnStill: true }}
            onFacePortraitCapture={onFaceCapture}
          />
        ) : (
          <CardScannerCameraView
            ref={cardCameraRef}
            style={styles.fullBleed}
            isActive={true}
            expectedSide="front"
            onPhotoCaptured={onCardPhotoCaptured}
          />
        )}
      </View>

      <View style={styles.actionContainer}>
        <Button
          title={mode === 'face' ? 'Capture Face' : 'Capture Card'}
          onPress={() => {
            if (mode === 'face') {
              faceCameraRef.current?.takePhoto();
            } else {
              cardCameraRef.current?.takePhoto();
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#1C1C1E',
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  cameraContainer: {
    flex: 1,
  },
  fullBleed: {
    flex: 1,
  },
  actionContainer: {
    padding: 16,
    backgroundColor: '#1C1C1E',
  },
});
