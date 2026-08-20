import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootReducerType } from '../../../../store/reducers';
import type { OcrCCCDUploadFile } from '../../data/dtos/OcrCCCDto';
import type {
  GetOcrInput,
  OcrCCCDEntity,
} from '../../domain/entities/OcrCCCDEntity';

export interface EkycState {
  loading: boolean;
  error: string | null;
  ocrData: OcrCCCDEntity | null;
  frontImage: OcrCCCDUploadFile | null;
  backImage: OcrCCCDUploadFile | null;
}

const initialState: EkycState = {
  loading: false,
  error: null,
  ocrData: null,
  frontImage: null,
  backImage: null,
};

const ekycSlice = createSlice({
  name: 'ekyc',
  initialState,
  reducers: {
    getOcrRequested(state, _action: PayloadAction<GetOcrInput>) {
      state.loading = true;
      state.error = null;
    },

    getOcrSuccess(state, action: PayloadAction<OcrCCCDEntity>) {
      state.loading = false;
      state.error = null;
      state.ocrData = action.payload;
      state.frontImage = null;
      state.backImage = null;
    },

    getOcrFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
      state.frontImage = null;
      state.backImage = null;
    },
    setFrontImage(state, action: PayloadAction<OcrCCCDUploadFile | null>) {
      state.frontImage = action.payload;
    },
    setBackImage(state, action: PayloadAction<OcrCCCDUploadFile | null>) {
      state.backImage = action.payload;
    },
  },
});

export const {
  getOcrRequested,
  getOcrSuccess,
  getOcrFailure,
  setFrontImage,
  setBackImage,
} = ekycSlice.actions;

export default ekycSlice.reducer;

export const ekycReducer = ekycSlice.reducer;

export const selectEkycReducer = (state: RootReducerType) => state.ekycReducer;

export const selectEkycLoading = (state: RootReducerType) =>
  selectEkycReducer(state).loading;

export const selectEkycError = (state: RootReducerType) =>
  selectEkycReducer(state).error;

export const selectOcrData = (state: RootReducerType) =>
  selectEkycReducer(state).ocrData;

export const selectFrontImage = (state: RootReducerType) =>
  selectEkycReducer(state).frontImage;

export const selectBackImage = (state: RootReducerType) =>
  selectEkycReducer(state).backImage;
