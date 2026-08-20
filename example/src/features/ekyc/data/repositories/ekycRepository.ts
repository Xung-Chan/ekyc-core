import { ekycApi } from '../datascource/ekycApi';
import { ekycMapper } from '../mappers/ekycMapper';
import type { GetOcrReposotiry } from '../../domain/usecase/getOcr';
import type { GetOcrInput } from '../../domain/entities/OcrCCCDEntity';
import type { OcrCCCDRequest } from '../dtos/OcrCCCDto';

export const ekycRepository: GetOcrReposotiry = {
  getOcr: async (input: GetOcrInput) => {
    const request: OcrCCCDRequest = {
      businessAction: 'registerNewCustomer',
      docType: 'ID_CARD',
      ekycTransactionId: '',
      ekycType: '',
      frontSide: input.frontSide,
      backSide: input.backSide,
    };
    const response = await ekycApi.getOcr(request);
    return ekycMapper.toDomain(response);
  },
};
