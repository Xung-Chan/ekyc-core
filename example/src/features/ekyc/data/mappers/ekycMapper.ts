import type { OcrCCCDEntity } from '../../domain/entities/OcrCCCDEntity';
import type { OcrCCCDResponse } from '../dtos/OcrCCCDto';

export const ekycMapper = {
  toDomain(response: OcrCCCDResponse): OcrCCCDEntity {
    return response.object;
  },
};
