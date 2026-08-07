import { create } from 'zustand';

/**
 * Undo/redo history — canvas snapshots serialized as JSON strings so they can
 * be deep-compared and re-hydrated without leaking function refs. Zustand port
 * of history.store.svelte.ts. `canUndo/canRedo` drive the toolbar buttons.
 */
const MAX_HISTORY = 50;

let past: string[] = [];
let future: string[] = [];
// Guard set true while undo/redo is restoring a snapshot; the record effect
// consumes it (skips one recording) so the applied change isn't re-pushed.
let applyingHistory = false;

type HistoryStore = { canUndo: boolean; canRedo: boolean };

export const useHistoryStore = create<HistoryStore>(() => ({ canUndo: false, canRedo: false }));

function updateFlags() {
  useHistoryStore.setState({ canUndo: past.length > 1, canRedo: future.length > 0 });
}

/** Replaces the stack with a single baseline snapshot (e.g. on hydrate). */
export function resetHistory(snapshot: string) {
  past = [snapshot];
  future = [];
  updateFlags();
}

/** Appends a snapshot if it differs from the last; clears redo. */
export function recordSnapshot(snapshot: string) {
  if (past.length > 0 && past[past.length - 1] === snapshot) return;
  past.push(snapshot);
  if (past.length > MAX_HISTORY) past.shift();
  future = [];
  updateFlags();
}

export function undo(): string | null {
  if (past.length <= 1) return null;
  const current = past.pop()!;
  future.push(current);
  updateFlags();
  return past[past.length - 1];
}

export function redo(): string | null {
  if (future.length === 0) return null;
  const next = future.pop()!;
  past.push(next);
  updateFlags();
  return next;
}

export const setApplyingHistory = (v: boolean) => {
  applyingHistory = v;
};
export const isApplyingHistory = () => applyingHistory;
