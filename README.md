# @xungchan/ekyc-core

Bộ SDK hỗ trợ đăng ký và xác thực eKYC trên nền tảng React Native. Thư viện tích hợp quét giấy tờ (CMND/CCCD/Hộ chiếu) và nhận diện khuôn mặt phục vụ cho quy trình định danh điện tử.

## Cài đặt

Thư viện yêu cầu cài đặt cùng với các thư viện phụ thuộc (peer dependencies):

```cmd
npm install @xungchan/ekyc-core react-native-svg react-native-vision-camera react-native-worklets-core
# hoặc sử dụng yarn
yarn add @xungchan/ekyc-core react-native-svg react-native-vision-camera react-native-worklets-core
```

### Cấu hình Native

Vì thư viện sử dụng Camera (qua `react-native-vision-camera`), bạn cần cấp quyền camera cho ứng dụng.

#### iOS

*(Tính năng hiện tại đang phát triển)*

#### Android
Đảm bảo quyền sau đã được thêm vào `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
```

---

## Tính năng

- [x] **Ekyc CardScanner Manual (Quét giấy tờ thủ công)**: Hiển thị khung camera chụp giấy tờ, cho phép người dùng bấm nút chụp và tự động crop, kiểm tra chất lượng hình ảnh (mờ, lóa, độ phơi sáng) cũng như nhận diện mặt trước/sau.
- [x] **Ekyc CardScanner Auto-Capture (Quét giấy tờ tự động)** (*Đang trong quá trình phát triển*)
- [ ] **Ekyc FacePortrait Scanner (Nhận diện & quét khuôn mặt)** (*Đang trong quá trình phát triển*)

---

## Hướng dẫn sử dụng Ekyc CardScanner Manual

Tính năng quét giấy tờ thủ công sử dụng component `<CardScannerCameraView>` với prop `autocapture={false}`. Bạn sẽ sử dụng một `ref` để trigger hành động chụp hình khi người dùng nhấn nút chụp (shutter).

### Code ví dụ chi tiết

```tsx
import React, { useRef, useState } from 'react';
import { StyleSheet, View, Text, Pressable, Alert } from 'react-native';
import { 
  CardScannerCameraView, 
  type CardScannerCameraViewRef, 
  type ScanCardResult 
} from '@xungchan/ekyc-core';

export default function CCCDCaptureScreen() {
  const cameraRef = useRef<CardScannerCameraViewRef>(null);
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front');
  const [isBusy, setIsBusy] = useState(false);

  // Callback trả về khi ảnh chụp đã được crop và phân tích chất lượng
  const handlePhotoCaptured = (imagePath: string, scanResult: ScanCardResult) => {
    console.log('Đường dẫn ảnh đã crop:', imagePath);
    console.log('Kết quả phân tích:', scanResult);

    if (!scanResult.success) {
      Alert.alert(
        'Lỗi nhận diện',
        scanResult.errorMessage || 'Không thể nhận diện được giấy tờ. Vui lòng chụp lại rõ nét hơn.'
      );
      return;
    }

    // Tiếp tục xử lý logic của bạn (ví dụ gửi lên API OCR)
    Alert.alert('Thành công', `Đã quét thành công mặt ${scanResult.side === 'front' ? 'trước' : 'sau'}`);
  };

  // Hàm xử lý khi nhấn nút chụp
  const handleShutterPress = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      // Gọi phương thức takePhoto thông qua ref
      const path = await cameraRef.current?.takePhoto();
      if (!path) {
        console.log('Không chụp được ảnh hoặc không trả về đường dẫn');
      }
    } catch (error) {
      console.error('Lỗi khi chụp hình:', error);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <CardScannerCameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        isActive={true}
        expectedSide={currentSide}
        onPhotoCaptured={handlePhotoCaptured}
        autocapture={false} // Chế độ chụp thủ công
        showGuide={true}     // Hiện khung overlay hướng dẫn đặt thẻ
      />

      {/* Giao diện nút chụp và chỉ dẫn */}
      <View style={styles.overlayContainer}>
        <Text style={styles.hintText}>
          Đặt mặt {currentSide === 'front' ? 'trước' : 'sau'} giấy tờ vào khung hình
        </Text>
        
        <Pressable 
          onPress={handleShutterPress} 
          style={styles.shutterButton}
          disabled={isBusy}
        >
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlayContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
  },
});
```

### API Reference - CardScannerCameraView

#### Props

| Tên Prop | Kiểu dữ liệu | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- |
| `isActive` | `boolean` | `true` | Điều khiển việc bật/tắt camera session. |
| `autocapture` | `boolean` | `false` | `false` cho chế độ chụp thủ công (Manual). |
| `expectedSide` | `'front' \| 'back'` | `undefined` | Mặt giấy tờ mong muốn quét. |
| `showGuide` | `boolean` | `true` | Bật/tắt khung viền chữ L và mặt nạ tối màu ở ngoài vùng quét. |
| `guideFrame` | `object` | `{ widthFraction: 0.86, aspectRatio: 1.586 }` | Điều chỉnh tỷ lệ kích thước khung hướng dẫn. |
| `targetFps` | `number` | `24` | Thiết lập FPS cho camera. |
| `onPhotoCaptured` | `(imagePath: string, scanResult: ScanCardResult) => void` | `undefined` | Callback được gọi sau khi chụp ảnh và xử lý thành công. |
| `style` | `ViewStyle` | `undefined` | Style áp dụng cho view camera. |

#### Ref Methods

Bạn có thể truyền một `ref` kiểu `CardScannerCameraViewRef` vào `CardScannerCameraView` để gọi các phương thức sau:

- `takePhoto(): Promise<string | null>`: Thực hiện chụp ảnh ngay lập tức, lưu tạm hình ảnh, tiến hành crop và phân tích chất lượng ảnh, sau đó kích hoạt callback `onPhotoCaptured`. Trả về đường dẫn ảnh gốc nếu thành công hoặc `null` nếu thất bại.
- `start()` / `reset()`: Bật lại camera preview và reset trạng thái xử lý ảnh.
- `stop()`: Dừng camera preview session.

#### ScanCardResult

Kết quả phân tích hình ảnh quét giấy tờ trả về gồm các thuộc tính sau:

```typescript
type ScanCardResult = {
  success: boolean;               // Xác định quét thẻ thành công hay không (ảnh đủ chất lượng & đúng mặt)
  originalImagePath: string;      // Đường dẫn file ảnh gốc chưa crop
  croppedImagePath?: string;      // Đường dẫn file ảnh đã được crop theo khung
  side: string;                   // Nhận diện mặt thẻ thực tế ('front' / 'back' / 'unknown')
  sideFrontScore: number;         // Điểm đánh giá mặt trước thẻ
  sideBackScore: number;          // Điểm đánh giá mặt sau thẻ
  quality: {
    passed: boolean;              // Ảnh có đạt tiêu chuẩn chất lượng hay không
    blurScore: number;            // Điểm mờ (càng thấp càng nét)
    motionScore: number;          // Điểm nhòe do chuyển động
    glareScore: number;           // Điểm chói sáng
    exposure: string;             // Trạng thái phơi sáng (ví dụ: "good")
    reasons: string[];            // Danh sách lý do từ chối nếu không đạt chất lượng (ví dụ: "BLURRY", "GLARE")
  };
  errorCode?: string;             // Mã lỗi nếu có
  errorMessage?: string;          // Chi tiết lỗi
};
```

---

## Đóng góp (Contributing)

Xem chi tiết tại [CONTRIBUTING.md](CONTRIBUTING.md) và tuân thủ [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Giấy phép (License)

Mã nguồn được phân phối dưới giấy phép **MIT**.