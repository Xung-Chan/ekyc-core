import { combineReducers } from '@reduxjs/toolkit';
import type { RootState } from '..';
import { ekycReducer } from '../../features/ekyc/presentation/state/ekyc.slice';

const rootReducers = (state: any, action: any) => {
  if (action.type === 'RESET_APP') {
    state = {} as RootState;
  }
  return allReducers(state, action);
};

const ekycReducers = {
  ekycReducer,
};

const allReducers = combineReducers({
  ...ekycReducers,
});

export type RootReducerType = ReturnType<typeof rootReducers>;

export default rootReducers;
