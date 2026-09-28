import type { PreviewResult } from './preview-api';

export interface PreviewState {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'unrecognized' | 'expired';
  requestId: string | null;
  result: PreviewResult | null;
  previous: PreviewResult | null;
  error: string | null;
}
export const initialPreviewState: PreviewState = {
  status: 'idle', requestId: null, result: null, previous: null, error: null,
};
export type PreviewAction =
  | { type: 'start'; id: string }
  | { type: 'resolve'; id: string; result: PreviewResult; now: number }
  | { type: 'reject'; id: string; error: string }
  | { type: 'capture-error'; error: string }
  | { type: 'cancel' }
  | { type: 'previous'; now: number }
  | { type: 'creation-availability'; id: string; documentHash: string; available: boolean }
  | { type: 'expire'; now: number };

function resultStatus(result: PreviewResult, now: number): PreviewState['status'] {
  if (now >= result.expiresAt) return 'expired';
  return result.document ? 'ready' : 'unrecognized';
}
function previousResult(state: PreviewState) {
  return state.result?.document && state.status === 'ready' ? state.result : state.previous;
}

/** Local review state only; no editor store, persistence, network or timers. */
export function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  switch (action.type) {
    case 'start': return { status: 'loading', requestId: action.id, result: null, previous: previousResult(state), error: null };
    case 'resolve':
      if (state.requestId !== action.id || state.status !== 'loading') return state;
      return { ...state, status: resultStatus(action.result, action.now), requestId: null, result: action.result,
        previous: state.previous };
    case 'reject':
      if (state.requestId !== action.id || state.status !== 'loading') return state;
      return { ...state, status: 'error', requestId: null, error: action.error };
    case 'capture-error': return { ...state, status: 'error', requestId: null, result: null, previous: previousResult(state), error: action.error };
    case 'cancel': return { ...state, status: 'idle', requestId: null, result: null, error: null };
    case 'previous':
      if (!state.previous || state.status === 'loading') return state;
      return { ...state, status: resultStatus(state.previous, action.now), result: state.previous,
        previous: state.result?.document ? state.result : null, error: null };
    case 'expire':
      if (state.status !== 'ready' || !state.result || action.now < state.result.expiresAt) return state;
      return { ...state, status: 'expired' };
    case 'creation-availability':
      if (state.status !== 'ready' || state.result?.id !== action.id || state.result.documentHash !== action.documentHash) return state;
      return { ...state, result: { ...state.result, creationAvailable: action.available } };
  }
}
