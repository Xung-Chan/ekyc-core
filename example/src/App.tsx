import {
  FacePortraitCameraView,
  type FacePortraitCameraViewRef,
} from '@xungchan/ekyc-core';
import { useRef } from 'react';
import { Button, StyleSheet, View } from 'react-native';

export default function App() {
  // const handlePress = async () => {
  //   const result = await finalizeFromPath({ imagePath: '' });
  //   console.log(result);
  // };
  const cameraRef = useRef<FacePortraitCameraViewRef>(null);
  const fullBleedStyle = { flex: 1 };
  const autoCapture = true;
  const isCameraActive = true;
  const phase = 'camera';
  const facePortraitCameraConfig = {};
  const onFacePortraitCapture = () => {};

  return (
    <View style={styles.container}>
      <Button title="Start Ekyc" onPress={() => {}} />
      <FacePortraitCameraView
        ref={cameraRef}
        style={fullBleedStyle}
        autoCapture={autoCapture}
        isActive={isCameraActive && phase === 'camera'}
        showFaceDetectionBox={false}
        config={facePortraitCameraConfig}
        onFacePortraitCapture={onFacePortraitCapture}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
