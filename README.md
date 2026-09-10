# @xungchan/ekyc-core

Bộ SDK hỗ trợ đăng ký và xác thực eKYC trên nền tảng React Native. Thư viện tích hợp quét giấy tờ (CMND/CCCD/Hộ chiếu) với công nghệ nhận diện 4 góc thẻ bằng mô hình học máy **TensorFlow Lite (LiteRT)** và nhận diện khuôn mặt phục vụ cho quy trình định danh điện tử.

## Cài đặt

Cài đặt thư viện cùng các thư viện phụ thuộc (peer dependencies):

```bash
npm install @xungchan/ekyc-core react-native-svg react-native-vision-camera react-native-worklets-core
# hoặc sử dụng yarn
yarn add @xungchan/ekyc-core react-native-svg react-native-vision-camera react-native-worklets-core
```

### Cấu hình Native

#### Android
1. Đảm bảo quyền Camera đã được khai báo trong `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
```
2. Thư viện tích hợp sẵn **Google LiteRT** (`com.google.ai.edge.litert:litert:1.4.1`) nhằm đảm bảo tương thích hoàn toàn với kiến trúc bộ nhớ **16KB page-size** trên Android 15+, cùng với OpenCV và Google ML Kit Text Recognition. Bạn không cần cấu hình thêm ở phía native app.

#### iOS
*(Đang trong quá trình phát triển)*

---

## Tính năng nổi bật

- [x] **Ekyc CardScanner Manual (Quét giấy tờ thủ công)**: Hiển thị khung camera với overlay chuẩn tỷ lệ thẻ CCCD, cho phép người dùng bấm nút chụp, tự động căn chỉnh và cắt phối cảnh (perspective warp), kiểm tra chất lượng hình ảnh (độ nét, lóa sáng, độ phơi sáng, tương phản) và nhận diện phân loại mặt trước/mặt sau qua ML Kit OCR.
- [x] **Ekyc CardScanner Auto-Capture (Quét giấy tờ tự động)**:
  - **Nhận diện 4 góc bằng AI (TFLite)**: Sử dụng mô hình SSD 512×512 (`model1.tflite`) phát hiện chính xác 4 góc thẻ trong thời gian thực.
  - **Kiểm tra vùng an toàn (ROI Validation)**: Đảm bảo đầy đủ 4 góc nằm trọn vẹn trong vùng ngắm với lề an toàn 2% (`marginFraction = 0.02`), ngăn chặn hoàn toàn tình trạng thẻ bị chụp mất góc hoặc cắt xén viền.
  - **Đổi màu viền trực quan**: Khung viền ngắm tự động chuyển sang màu **xanh lá** (`#4CD964`) khi thẻ hợp lệ và giữ màu **trắng** khi chưa phát hiện thẻ.
  - **Tự động chụp & Tối ưu hiệu năng**: Khi thẻ ổn định và vượt qua kiểm tra chất lượng (độ mờ < 150.0, lóa sáng ≤ 8%), hệ thống sẽ tự động chụp, cắt phối cảnh và trả về kết quả. Tự động áp dụng cache OCR (30s) và giãn cách chu kỳ phát hiện AI (1 lần/5 frame) giúp tiết kiệm pin và giảm nhiệt thiết bị.
  - **Cơ chế Fallback OpenCV**: Tự động chuyển đổi sang thuật toán Canny Contour của OpenCV nếu mô hình AI gặp lỗi.
- [x] **Ekyc FacePortrait Scanner (Nhận diện & quét khuôn mặt)**: Cung cấp component `<FacePortraitCameraView>` hỗ trợ khung oval định vị khuôn mặt, kiểm tra góc nghiêng, trạng thái mở mắt và chống lóa sáng.

---

## Hướng dẫn sử dụng Ekyc CardScanner Manual

Tính năng quét giấy tờ thủ công sử dụng component `<CardScannerCameraView>` với prop `autocapture={false}`. Bạn sẽ sử dụng `ref` kiểu `CardScannerCameraViewRef` để kích hoạt phương thức `takePhoto()` khi người dùng bấm nút chụp (shutter).

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

  // Callback trả về khi ảnh chụp đã được crop và phân tích chất lượng hoàn tất
  const handlePhotoCaptured = (imagePath: string, scanResult: ScanCardResult) => {
    console.log('Đường dẫn ảnh đã crop:', imagePath);
    console.log('Kết quả phân tích chi tiết:', scanResult);

    if (!scanResult.success) {
      Alert.alert(
        'Lỗi nhận diện',
        scanResult.errorMessage || 'Không thể nhận diện được giấy tờ. Vui lòng chụp lại rõ nét hơn.'
      );
      return;
    }

    // Xử lý thành công (ví dụ: chuyển sang chụp mặt sau hoặc gửi lên server OCR)
    Alert.alert('Thành công', `Đã quét thành công mặt ${scanResult.side === 'front' ? 'trước' : 'sau'}`);
  };

  // Hàm xử lý khi nhấn nút chụp hình
  const handleShutterPress = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      // Phương thức takePhoto() sẽ tự động chụp, crop phối cảnh và phân tích chất lượng
      const croppedPath = await cameraRef.current?.takePhoto();
      if (!croppedPath) {
        console.log('Không chụp được ảnh hoặc quá trình xử lý thất bại');
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
        showGuide={true}     // Hiển thị khung ngắm và mặt nạ tối màu
      >
        {/* Render giao diện nút chụp bên trong camera view */}
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
      </CardScannerCameraView>
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

---

## Hướng dẫn sử dụng Ekyc CardScanner Auto-Capture

Tính năng tự động quét sử dụng component `<CardScannerCameraView>` với prop `autocapture={true}`. Hệ thống sẽ phân tích từng frame hình ảnh theo thời gian thực (chu kỳ mặc định 250ms).

Khung viền camera sẽ tự động chuyển màu **xanh lá** (`#4CD964`) khi phát hiện thẻ hợp lệ. Khi khung hình đạt chuẩn (rõ nét, không lóa và đúng mặt thẻ mong muốn), hệ thống tự động chụp và trả kết quả qua callback `onPhotoCaptured`.

### Code ví dụ chi tiết cho Auto-Capture

```tsx
import React, { useState } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { 
  CardScannerCameraView, 
  type ScanCardResult,
  type ScanFrameResult 
} from '@xungchan/ekyc-core';

export default function AutoCaptureScreen() {
  const [hint, setHint] = useState('Đặt giấy tờ vào khung hình');
  const [hintType, setHintType] = useState<'neutral' | 'warning' | 'success'>('neutral');

  // Callback phản hồi chất lượng frame thời gian thực
  const handleFrameValidated = (result: ScanFrameResult) => {
    if (!result.isDocumentPresent) {
      setHint('Đặt giấy tờ vào khung hình');
      setHintType('neutral');
    } else if (result.errorCode) {
      // errorCode có thể là: "IMAGE_TOO_BLURRY", "IMAGE_HAS_GLARE"
      setHint(result.errorMessage || 'Chất lượng hình ảnh không đạt yêu cầu');
      setHintType('warning');
    } else {
      // Đủ 4 góc, ảnh nét và không bị lóa sáng
      setHint('Giữ nguyên để tự động chụp...');
      setHintType('success');
    }
  };

  // Callback trả về khi đã chụp và xử lý thẻ thành công
  const handlePhotoCaptured = (imagePath: string, scanResult: ScanCardResult) => {
    if (!scanResult.success) {
      Alert.alert('Lỗi nhận diện', scanResult.errorMessage || 'Không đạt tiêu chuẩn');
      return;
    }
    Alert.alert('Thành công', `Đã chụp tự động mặt ${scanResult.side === 'front' ? 'trước' : 'sau'}!`);
  };

  return (
    <View style={styles.container}>
      <CardScannerCameraView
        style={StyleSheet.absoluteFill}
        isActive={true}
        autocapture={true} // Bật chế độ tự động chụp
        expectedSide="front" // Kỳ vọng quét mặt trước ('front' hoặc 'back')
        onFrameValidated={handleFrameValidated}
        onPhotoCaptured={handlePhotoCaptured}
      >
        <View style={styles.hintContainer}>
          <Text style={[styles.hintText, styles[hintType]]}>{hint}</Text>
        </View>
      </CardScannerCameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  hintText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  neutral: { color: '#ffffff' },
  warning: { color: '#ffcc00' },
  success: { color: '#4cd964' },
});
```

---

## API Reference

### Component: `CardScannerCameraView`

#### Props

| Tên Prop | Kiểu dữ liệu | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- |
| `isActive` | `boolean` | `true` | Bật/tắt camera session. |
| `autocapture` | `boolean` | `false` | Bật/tắt chế độ tự động phát hiện và chụp giấy tờ. |
| `expectedSide` | `'front' \| 'back'` | `undefined` | Mặt thẻ dự kiến quét (kiểm tra so khớp sau khi OCR). |
| `showGuide` | `boolean` | `true` | Bật/tắt khung viền chữ L và mặt nạ tối màu ngoài vùng quét. |
| `guideFrame` | `CardScannerCameraViewGuideConfig` | `DEFAULT_GUIDE` | Tùy chỉnh tỷ lệ khung ngắm (`{ widthFraction: 0.86, aspectRatio: 1.586 }`). |
| `targetFps` | `number` | `24` | Tốc độ khung hình (FPS) của camera. |
| `style` | `ViewStyle` | `undefined` | Style tùy biến cho vùng hiển thị camera view. |
| `children` | `React.ReactNode` | `undefined` | Giao diện tùy biến lồng bên trong camera view (nút bấm, chỉ dẫn UI,...). |
| `onPhotoCaptured` | `(imagePath: string, scanResult: ScanCardResult) => void` | `undefined` | Callback gọi khi ảnh chụp đã được crop phối cảnh và phân tích xong. |
| `onFrameValidated` | `(result: ScanFrameResult) => void` | `undefined` | Callback trả về trạng thái frame thời gian thực trong chế độ auto-capture. |

#### Ref Methods (`CardScannerCameraViewRef`)

| Tên phương thức | Kiểu trả về | Mô tả |
| :--- | :--- | :--- |
| `takePhoto()` | `Promise<string \| null>` | Chụp ảnh thủ công ngay lập tức, tự động tính toán toạ độ cắt, thực hiện perspective warp và kiểm tra chất lượng. Trả về đường dẫn ảnh đã crop hoặc `null` nếu thất bại. |
| `start()` | `void` | Mở lại camera preview, gỡ bỏ capture lock và reset trạng thái bắt thẻ. |
| `reset()` | `void` | Reset trạng thái validation và capture lock để sẵn sàng cho lần quét mới. |
| `stop()` | `void` | Tạm dừng quá trình xử lý camera. |

---

### Data Types

#### `ScanCardResult`
Kết quả phân tích toàn diện sau khi chụp và xử lý thẻ:

```typescript
export type ScanCardResult = {
  success: boolean;               // Quét thẻ thành công (đủ 4 góc, đúng mặt và đạt chuẩn chất lượng)
  croppedImagePath?: string;      // Đường dẫn file ảnh đã được crop phối cảnh theo 4 góc thẻ
  originalImagePath?: string;     // Đường dẫn file ảnh gốc chưa crop từ camera (nếu có)
  side: 'front' | 'back' | 'unknown'; // Nhận diện mặt thẻ thực tế
  blurScore?: number;             // Phương sai Laplacian đo độ nét (càng cao càng nét)
  glarePercent?: number;          // Tỷ lệ vùng bị lóa sáng (%)
  errorCode?: string;             // Mã lỗi nếu thất bại (xem bảng danh mục mã lỗi bên dưới)
  errorMessage?: string;          // Thông báo lỗi chi tiết
};
```

#### `CropRect`
Tọa độ hình chữ nhật cắt ảnh:

```typescript
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

#### `CardCapturedEvent`
Sự kiện native được phát ra khi auto-capture hoàn tất:

```typescript
export type CardCapturedEvent =
  | {
      success: true;
      croppedImagePath: string;
      blurScore: number;
      glarePercent: number;
      side: string;
      sideFrontScore: number;
      sideBackScore: number;
      appliedCrop: CropRect;
    }
  | {
      success: false;
      errorCode: string;
      errorMessage: string;
    };
```

#### `ScanFrameResult`
Kết quả phân tích từng frame thời gian thực trong chế độ auto-capture:

```typescript
export interface ScanFrameResult {
  isDocumentPresent: boolean;     // Đã tìm thấy đủ 4 góc giấy tờ hợp lệ và nằm trọn trong vùng ngắm (ROI)
  errorCode: string;              // Mã lỗi ("" nếu hợp lệ, "DOCUMENT_NOT_PRESENT", "IMAGE_TOO_BLURRY", "IMAGE_HAS_GLARE")
  errorMessage: string;           // Thông báo hướng dẫn người dùng tương ứng
}
```

---

### Danh mục mã lỗi (`errorCode`)

#### 1. Lỗi phân tích khung hình thời gian thực (`ScanFrameResult`)

| Mã lỗi (`errorCode`) | Ý nghĩa | Thông báo (`errorMessage`) |
| :--- | :--- | :--- |
| `""` *(chuỗi rỗng)* | Khung hình hoàn toàn hợp lệ, đủ điều kiện tự động chụp. | `""` |
| `DOCUMENT_NOT_PRESENT` | Chưa phát hiện đủ 4 góc thẻ hoặc thẻ bị lọt ra ngoài vùng biên ngắm ROI (lề 2%). | `Đặt giấy tờ vào khung hình` |
| `IMAGE_TOO_BLURRY` | Khung hình bị mờ nhòe (phương sai Laplacian < `blurThreshold`). | `Hình ảnh bị mờ, vui lòng giữ yên thiết bị` |
| `IMAGE_HAS_GLARE` | Khung hình bị lóa sáng vượt ngưỡng cho phép (> `glareThreshold`). | `Hình ảnh bị lóa sáng, vui lòng điều chỉnh góc chụp` |

#### 2. Lỗi quá trình chụp & phân tích thẻ (`ScanCardResult`)

| Mã lỗi (`errorCode`) | Giai đoạn | Ý nghĩa |
| :--- | :--- | :--- |
| `NO_CARD_QUAD` | Phát hiện thẻ | Không tìm thấy đủ 4 góc thẻ hoặc góc thẻ lọt ra ngoài vùng ngắm an toàn. |
| `WARP_FAILED` | Cắt phối cảnh | Lỗi tính ma trận biến đổi phối cảnh (Perspective Transform) từ 4 điểm góc. |
| `IMAGE_TOO_BLURRY` | Kiểm tra chất lượng | Ảnh chụp bị mờ (điểm phương sai Laplacian dưới ngưỡng cấu hình). |
| `IMAGE_HAS_GLARE` | Kiểm tra chất lượng | Ảnh xuất hiện vệt chói sáng chiếm tỷ lệ lớn (mặc định > 8%). |
| `IMAGE_TOO_DARK` | Kiểm tra chất lượng | Ảnh chụp quá tối (độ sáng pixel trung bình < 58.0). |
| `IMAGE_TOO_BRIGHT` | Kiểm tra chất lượng | Ảnh chụp quá sáng/cháy sáng (độ sáng pixel trung bình > 198.0). |
| `IMAGE_LOW_CONTRAST` | Kiểm tra chất lượng | Độ tương phản giữa các pixel quá thấp (< 12.0). |
| `IMAGE_HAS_MOTION_BLUR` | Kiểm tra chất lượng | Ảnh bị nhòe vệt do di chuyển camera trong lúc chụp. |
| `OCR_FAILED` | Nhận diện chữ | Không đọc được bất kỳ ký tự nào trên thẻ. |
| `EXPECTED_FRONT_BUT_GOT_BACK` | Phân loại mặt thẻ | Yêu cầu quét mặt trước nhưng thông tin trên thẻ là mặt sau. |
| `EXPECTED_BACK_BUT_GOT_FRONT` | Phân loại mặt thẻ | Yêu cầu quét mặt sau nhưng thông tin trên thẻ là mặt trước. |
| `INVALID_INPUT` / `IMAGE_LOAD_FAILED` | Hệ thống | Đường dẫn ảnh không hợp lệ hoặc không thể đọc file ảnh từ bộ nhớ. |

---

### Các hằng số mặc định (Constants)

Bạn có thể import các hằng số cấu hình từ `@xungchan/ekyc-core`:

```typescript
import {
  DEFAULT_GUIDE,                      // { widthFraction: 0.86, aspectRatio: 1.586 }
  CARD_SCANNER_DEFAULT_THROTTLE_MS,   // 250 (ms) - khoảng thời gian giãn cách giữa các frame phân tích
  CARD_SCANNER_DEFAULT_BLUR_THRESHOLD,// 150.0 - ngưỡng phương sai Laplacian tối thiểu
  CARD_SCANNER_DEFAULT_GLARE_THRESHOLD,// 0.08 - ngưỡng tỷ lệ lóa sáng tối đa (8%)
  EVENTS_NAME,                        // { CARD_CAPTURED: 'onCardCaptured' }
  CAMERA_VIDEO_RESOLUTION_FHD,        // { width: 1920, height: 1080 }
} from '@xungchan/ekyc-core';
```

---

## Đóng góp (Contributing)

Mọi đóng góp phát triển thư viện xin xem tại [CONTRIBUTING.md](CONTRIBUTING.md) và tuân thủ [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Giấy phép (License)

Mã nguồn được phân phối dưới giấy phép **MIT**.