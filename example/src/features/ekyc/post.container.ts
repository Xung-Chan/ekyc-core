import { ekycRepository } from './data/repositories/ekycRepository';
import { getOcr } from './domain/usecase/getOcr';

export const ekycUsecases = {
  getOcr: getOcr(ekycRepository),
};
