/**
 * History Store Module
 *
 * Tracks canvas snapshots (serialized {nodes, edges}) for undo/redo.
 * Snapshots are stored as JSON strings so they can be deep-compared and
 * re-hydrated without leaking function references (e.g. node.data.onEdit).
 *
 * Public API:
 * - historyState: { canUndo, canRedo } reactive flags for UI buttons.
 * - resetHistory(snapshot): replaces the stack with a single baseline.
 * - recordSnapshot(snapshot): appends a snapshot if it differs from the last
 *     entry. Clears the redo stack (any new edit invalidates redo).
 * - undo(): returns the previous snapshot or null if nothing to undo.
 * - redo(): returns the next snapshot or null if nothing to redo.
 */

const MAX_HISTORY = 50;

let past: string[] = [];
let future: string[] = [];

export const historyState = $state({
    canUndo: false,
    canRedo: false
});

function updateFlags() {
    historyState.canUndo = past.length > 1;
    historyState.canRedo = future.length > 0;
}

// Replaces the stack with a single baseline snapshot (e.g. after page hydrate).
export function resetHistory(snapshot: string) {
    past = [snapshot];
    future = [];
    updateFlags();
}

// Appends a snapshot if it differs from the last recorded one.
export function recordSnapshot(snapshot: string) {
    if (past.length > 0 && past[past.length - 1] === snapshot) return;
    past.push(snapshot);
    if (past.length > MAX_HISTORY) past.shift();
    future = [];
    updateFlags();
}

// Pops the current snapshot, pushes it to redo, and returns the previous one.
export function undo(): string | null {
    if (past.length <= 1) return null;
    const current = past.pop()!;
    future.push(current);
    updateFlags();
    return past[past.length - 1];
}

// Pops the next redo snapshot back onto the past stack and returns it.
export function redo(): string | null {
    if (future.length === 0) return null;
    const next = future.pop()!;
    past.push(next);
    updateFlags();
    return next;
}
