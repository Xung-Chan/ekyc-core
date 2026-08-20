import { ENDPOINTS } from '../../../../api/endpoints';
import { api, uploadFileUri } from '../../../../api/fetch';
import type { OcrCCCDRequest, OcrCCCDResponse } from '../dtos/OcrCCCDto';

export const ekycApi = {
  async getOcr(request: OcrCCCDRequest): Promise<OcrCCCDResponse> {
    // Chuyển file:// URI → data: URI (base64) để tránh "Stream Closed" trong OkHttp.
    // RN's NetworkingModule không thể đọc FileInputStream từ file:// URI ổn định;
    // data: URI được xử lý trực tiếp trong memory, không có race condition.
    const [frontDataUri, backDataUri] = await Promise.all([
      uploadFileUri(request.frontSide.uri),
      uploadFileUri(request.backSide.uri),
    ]);

    const formData = new FormData();

    formData.append(
      'ekycRequest',
      JSON.stringify({
        ekycTransactionId: '8299d4dd-96a1-4f6f-a5aa-02f064715bb4',
        ekycType: 'SIGNUP',
        ekycService: 'OCR',
        docType: 'CCCD',
        // ekycType: request.ekycType,
        // docType: request.docType,
      })
    );

    formData.append('frontSide', {
      uri: frontDataUri,
      name: request.frontSide.name,
      type: request.frontSide.type,
    } as any);

    formData.append('backSide', {
      uri: backDataUri,
      name: request.backSide.name,
      type: request.backSide.type,
    } as any);

    return api.upload(ENDPOINTS.OCR, formData);
  },
  async testApi(request: OcrCCCDRequest): Promise<OcrCCCDResponse> {
    const [frontDataUri] = await Promise.all([
      uploadFileUri(request.frontSide.uri),
      // uploadFileUri(request.backSide.uri),
    ]);

    const formData = new FormData();
    formData.append('file', {
      uri: frontDataUri,
      name: request.frontSide.name,
      type: request.frontSide.type,
    } as any);
    console.log('Form data', formData);
    try {
      const a = await api.upload('/files/upload', formData);
      console.log('=== UPLOAD TEST SUCCEEDED ===', a);
    } catch (err: any) {
      console.error('=== UPLOAD TEST FAILED ===', err);
    }
    return {} as OcrCCCDResponse;
  },
};
