import Config from 'react-native-config';
import { ENDPOINTS } from '../../../../api/endpoints';
import { api } from '../../../../api/fetch';
import type { OcrCCCDRequest, OcrCCCDResponse } from '../dtos/OcrCCCDto';

export const ekycApi = {
  async getOcr(request: OcrCCCDRequest): Promise<OcrCCCDResponse> {
    const formData = new FormData();

    formData.append(
      'ekycRequest',
      JSON.stringify({
        ekycTransactionId: Config.EKYC_TRANSACTION_ID || '',
        ekycType: 'SIGNUP',
        ekycService: 'OCR',
        docType: 'CCCD',
      })
    );

    formData.append('frontSide', {
      uri: urimapper(request.frontSide.uri),
      name: request.frontSide.name,
      type: request.frontSide.type,
    } as any);

    formData.append('backSide', {
      uri: urimapper(request.backSide.uri),
      name: request.backSide.name,
      type: request.backSide.type,
    } as any);

    return api.upload(ENDPOINTS.OCR, formData);
  },
  async testApi(request: OcrCCCDRequest): Promise<OcrCCCDResponse> {
    const formData = new FormData();
    formData.append('file', {
      uri: request.frontSide.uri,
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

export function urimapper(uri: string): string {
  if (uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }
  return uri;
}
