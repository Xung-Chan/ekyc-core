import { ENDPOINTS } from '../../../../api/endpoints';
import { api } from '../../../../api/fetch';
import type { OcrCCCDRequest, OcrCCCDResponse } from '../dtos/OcrCCCDto';

export const ekycApi = {
  async getOcr(request: OcrCCCDRequest): Promise<OcrCCCDResponse> {
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
    formData.append('frontSide', request.frontSide as any);
    formData.append('backSide', request.backSide as any);
    return api.upload(ENDPOINTS.OCR, formData);
  },
  async testApi(request: OcrCCCDRequest): Promise<OcrCCCDResponse> {
    const formData = new FormData();
    formData.append('title', 'test upload');
    formData.append('frontSide', request.frontSide as any);
    formData.append('backSide', request.backSide as any);

    try {
      const a = await api.upload('/posts', formData);
      console.log('=== UPLOAD TEST SUCCEEDED ===', a);
    } catch (err: any) {
      console.error('=== UPLOAD TEST FAILED ===', err);
    }
    return {} as OcrCCCDResponse;
  },
};
