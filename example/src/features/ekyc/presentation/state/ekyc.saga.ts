import { call, put, takeLatest } from 'redux-saga/effects';
import { getOcrRequested, getOcrSuccess, getOcrFailure } from './ekyc.slice';
import { ekycUsecases } from '../../post.container';

function* getOcrRequestedSaga(
  action: ReturnType<typeof getOcrRequested>
): Generator<any, void, any> {
  try {
    const response = yield call(ekycUsecases.getOcr, action.payload);
    yield put(getOcrSuccess(response));
  } catch (error: any) {
    yield put(getOcrFailure(error?.message ?? 'Get Ocr Failed'));
  }
}

export function* ekycSaga() {
  yield takeLatest(getOcrRequested.type, getOcrRequestedSaga);
}
