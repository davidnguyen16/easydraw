import { create } from 'zustand';

// Left sidebar resize/collapse state (Zustand port of sidebar.store.svelte.ts).
export const MIN_WIDTH = 80;
export const MAX_WIDTH = 600;
export const DEFAULT_WIDTH = 220;
export const COLLAPSE_THRESHOLD = 80;
export const SIDEBAR_RESIZE_HANDLE_OVERHANG_PX = 3;

const STORAGE_KEY = 'easydraw.sidebar.v1';
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

type SidebarStore = {
  width: number;
  isCollapsed: boolean;
  isResizing: boolean;
  renderedWidth: number;
  setWidth: (next: number) => void;
  toggleCollapse: () => void;
  expand: () => void;
  setResizing: (v: boolean) => void;
  setRenderedWidth: (w: number) => void;
  persist: () => void;
  load: () => void;
};

export const useSidebarStore = create<SidebarStore>((set, get) => ({
  width: DEFAULT_WIDTH,
  isCollapsed: false,
  isResizing: false,
  renderedWidth: DEFAULT_WIDTH,
  // Dragging below the collapse threshold auto-collapses without changing width.
  setWidth: (next) => {
    if (next < COLLAPSE_THRESHOLD) {
      set({ isCollapsed: true });
      return;
    }
    set({ width: clamp(next, MIN_WIDTH, MAX_WIDTH), isCollapsed: false });
  },
  toggleCollapse: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
  expand: () => set({ isCollapsed: false }),
  setResizing: (v) => set({ isResizing: v }),
  setRenderedWidth: (w) => set({ renderedWidth: w }),
  persist: () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ width: get().width, isCollapsed: get().isCollapsed }),
      );
    } catch {
      // Fail silently if storage is unavailable.
    }
  },
  load: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return;
      const snap = parsed as { width?: unknown; isCollapsed?: unknown };
      if (typeof snap.width !== 'number' || typeof snap.isCollapsed !== 'boolean') return;
      set({ width: clamp(snap.width, MIN_WIDTH, MAX_WIDTH), isCollapsed: snap.isCollapsed });
    } catch {
      // Fail silently on bad data.
    }
  },
}));
