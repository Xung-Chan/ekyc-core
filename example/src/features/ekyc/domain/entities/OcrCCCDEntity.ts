import type {
  OcrCCCDObject,
  OcrCCCDUploadFile,
} from '../../data/dtos/OcrCCCDto';

export interface OcrCCCDEntity extends OcrCCCDObject {}

export interface GetOcrInput {
  frontSide: OcrCCCDUploadFile;
  backSide: OcrCCCDUploadFile;
}
