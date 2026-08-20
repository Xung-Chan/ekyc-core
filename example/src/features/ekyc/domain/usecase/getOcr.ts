import type { GetOcrInput, OcrCCCDEntity } from '../entities/OcrCCCDEntity';

export interface GetOcrReposotiry {
  getOcr(input: GetOcrInput): Promise<OcrCCCDEntity>;
}

export const getOcr =
  (repository: GetOcrReposotiry) =>
  async (input: GetOcrInput): Promise<OcrCCCDEntity> => {
    return repository.getOcr(input);
  };
