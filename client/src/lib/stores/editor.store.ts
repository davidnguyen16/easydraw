import { create } from 'zustand';
import type { Diagram3DTool, DiagramViewMode } from '@/lib/diagram3d/types';

/**
 * Editor UI state (Zustand) — the local, non-graph flags the toolbar / menubar
 * drive. Mirrors the pieces of the SvelteKit editor.store the chrome reads.
 */
type EditorUiState = {
  viewMode: DiagramViewMode;
  tool3d: Diagram3DTool;
  zoom3d: number;
  setViewMode: (mode: DiagramViewMode) => void;
  setTool3d: (tool: Diagram3DTool) => void;
  setZoom3d: (percent: number) => void;
  locked: boolean;
  showStylePanel: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  presenting: boolean;
  saveStatus: 'saved' | 'saving' | 'error';
  toggleLock: () => void;
  toggleStylePanel: () => void;
  toggleShowGrid: () => void;
  toggleSnapToGrid: () => void;
  setPresenting: (value: boolean) => void;
  setSaveStatus: (value: 'saved' | 'saving' | 'error') => void;
};

export const useEditorStore = create<EditorUiState>((set) => ({
  viewMode: '2d',
  tool3d: 'select',
  zoom3d: 100,
  setViewMode: (viewMode) => set({ viewMode }),
  setTool3d: (tool3d) => set({ tool3d }),
  setZoom3d: (zoom3d) => set({ zoom3d }),
  locked: false,
  showStylePanel: true,
  showGrid: true,
  snapToGrid: false,
  presenting: false,
  saveStatus: 'saved',
  toggleLock: () => set((s) => ({ locked: !s.locked })),
  toggleStylePanel: () => set((s) => ({ showStylePanel: !s.showStylePanel })),
  toggleShowGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  setPresenting: (value) => set({ presenting: value }),
  setSaveStatus: (value) => set({ saveStatus: value }),
}));
