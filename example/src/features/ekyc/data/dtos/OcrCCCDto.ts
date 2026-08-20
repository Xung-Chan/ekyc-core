export interface OcrCCCDRequest {
  ekycTransactionId: string;
  ekycType: string;
  businessAction: string;
  docType: string;
  frontSide: OcrCCCDUploadFile;
  backSide: OcrCCCDUploadFile;
}
export type OcrCCCDUploadFile = {
  uri: string;
  name: string;
  type: string;
};
export interface OcrCCCDResponse {
  error: boolean;
  errorReason: string;
  toastMessage: string;
  object: OcrCCCDObject;
}
export interface OcrCCCDObject {
  cccdFrontImageBase64?: string;
  ekycService?: string;
  ekycTransactionRefId?: string;
  ekycSessionPartnerId?: string;
  providerCode?: string;
  ekycTransactionId?: string;
  extractData?: ExtractData;
  frontImageUrl?: string;
  docType?: string;
  cccdBackImageBase64?: string;
  nextAction?: string;
  backImageUrl?: string;
}

export interface ExtractData {
  gender?: string;
  fullName?: string;
  expiryDate?: string;
  nationality?: string;
  dateOfBirth?: string;
  documentNumber?: string;
  placeOfResidence?: string;
  placeOfIssue?: string;
  dateOfIssue?: string;
  placeOfOrigin?: string;
}
