import { all, fork } from 'redux-saga/effects';
import { ekycSaga } from '../../features/ekyc/presentation/state/ekyc.saga';

function* rootSaga() {
  yield all([fork(ekycSaga)]);
}

export default rootSaga;
