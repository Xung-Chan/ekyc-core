export interface OcrCCCDEntity {
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
