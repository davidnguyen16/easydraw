import { create } from 'zustand';

/**
 * Editor UI state (Zustand) — the local, non-graph flags the toolbar / menubar
 * drive. Mirrors the pieces of the SvelteKit editor.store the chrome reads.
 */
type EditorUiState = {
  locked: boolean;
  showStylePanel: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  presenting: boolean;
  toggleLock: () => void;
  toggleStylePanel: () => void;
  toggleShowGrid: () => void;
  toggleSnapToGrid: () => void;
  setPresenting: (value: boolean) => void;
};

export const useEditorStore = create<EditorUiState>((set) => ({
  locked: false,
  showStylePanel: true,
  showGrid: true,
  snapToGrid: false,
  presenting: false,
  toggleLock: () => set((s) => ({ locked: !s.locked })),
  toggleStylePanel: () => set((s) => ({ showStylePanel: !s.showStylePanel })),
  toggleShowGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  setPresenting: (value) => set({ presenting: value }),
}));
