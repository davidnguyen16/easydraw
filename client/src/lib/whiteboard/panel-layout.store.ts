import { create } from 'zustand';
import {
  clampPanelWidth, DEFAULT_PANEL_PREFERENCES, PANEL_LAYOUT_STORAGE_KEY,
  PREVIEW_MAX_WIDTH, PREVIEW_MIN_WIDTH, readPanelPreferences, TOOLS_MAX_WIDTH, TOOLS_MIN_WIDTH,
  type PanelPreferences,
} from './panel-layout';

type Panel = 'tools' | 'preview';
interface PanelLayoutState extends PanelPreferences {
  loaded: boolean;
  load(): void;
  setWidth(panel: Panel, width: number): void;
  toggle(panel: Panel): void;
  persist(): void;
}

/** UI-only preferences. Never touch the paint engine, preview or diagram store. */
export const useWhiteboardPanelLayout = create<PanelLayoutState>((set, get) => ({
  ...DEFAULT_PANEL_PREFERENCES,
  loaded: false,
  load() {
    if (get().loaded || typeof window === 'undefined') return;
    try { set({ ...readPanelPreferences(localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY)), loaded: true }); }
    catch { set({ loaded: true }); }
  },
  setWidth(panel, width) {
    if (!Number.isFinite(width)) return;
    if (panel === 'tools') set({ toolsWidth: clampPanelWidth(width, TOOLS_MIN_WIDTH, TOOLS_MAX_WIDTH) });
    else set({ previewWidth: clampPanelWidth(width, PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH) });
  },
  toggle(panel) {
    set((state) => panel === 'tools' ? { toolsCollapsed: !state.toolsCollapsed } : { previewCollapsed: !state.previewCollapsed });
    get().persist();
  },
  persist() {
    if (typeof window === 'undefined') return;
    const { toolsWidth, previewWidth, toolsCollapsed, previewCollapsed } = get();
    try { localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify({ toolsWidth, previewWidth, toolsCollapsed, previewCollapsed })); }
    catch { /* Storage restrictions must not disable resizing. */ }
  },
}));
