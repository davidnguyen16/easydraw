/** Layout preferences are independent of drawing data and the Diagram sidebar. */
export const PANEL_LAYOUT_STORAGE_KEY = 'easydraw.whiteboard-layout.v1';
export const COLLAPSED_PANEL_WIDTH = 32;
export const TOOLS_MIN_WIDTH = 112;
export const TOOLS_MAX_WIDTH = 360;
export const PREVIEW_MIN_WIDTH = 320;
export const PREVIEW_MAX_WIDTH = 760;

export interface PanelPreferences {
  toolsWidth: number;
  previewWidth: number;
  toolsCollapsed: boolean;
  previewCollapsed: boolean;
}

export const DEFAULT_PANEL_PREFERENCES: PanelPreferences = {
  toolsWidth: 232,
  previewWidth: 460,
  toolsCollapsed: false,
  previewCollapsed: false,
};

export function clampPanelWidth(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

/** Reject malformed persisted preferences; never let NaN/Infinity enter CSS. */
export function readPanelPreferences(raw: string | null): PanelPreferences {
  if (!raw) return { ...DEFAULT_PANEL_PREFERENCES };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_PANEL_PREFERENCES };
    const prefs = value as Partial<PanelPreferences>;
    if (typeof prefs.toolsWidth !== 'number' || !Number.isFinite(prefs.toolsWidth) ||
      typeof prefs.previewWidth !== 'number' || !Number.isFinite(prefs.previewWidth) ||
      typeof prefs.toolsCollapsed !== 'boolean' || typeof prefs.previewCollapsed !== 'boolean') return { ...DEFAULT_PANEL_PREFERENCES };
    return {
      toolsWidth: clampPanelWidth(prefs.toolsWidth, TOOLS_MIN_WIDTH, TOOLS_MAX_WIDTH),
      previewWidth: clampPanelWidth(prefs.previewWidth, PREVIEW_MIN_WIDTH, PREVIEW_MAX_WIDTH),
      toolsCollapsed: prefs.toolsCollapsed,
      previewCollapsed: prefs.previewCollapsed,
    };
  } catch { return { ...DEFAULT_PANEL_PREFERENCES }; }
}

/** Clamp rendered sizes, not stored preferences, when the window changes.
 * Wide layouts reserve 320px for drawing; narrow layouts keep full-width tabs. */
export function resolvePanelLayout(viewportWidth: number, wide: boolean, prefs: PanelPreferences) {
  const available = Math.max(0, Number.isFinite(viewportWidth) ? viewportWidth : 0);
  const canvasMinimum = Math.min(wide ? 320 : 160, Math.max(0, available - TOOLS_MIN_WIDTH - (wide ? PREVIEW_MIN_WIDTH : 0)));
  const previewMinimum = wide ? (prefs.previewCollapsed ? COLLAPSED_PANEL_WIDTH : PREVIEW_MIN_WIDTH) : 0;
  const toolBudget = Math.max(TOOLS_MIN_WIDTH, Math.min(TOOLS_MAX_WIDTH, available - previewMinimum - canvasMinimum));
  const toolsWidth = prefs.toolsCollapsed ? COLLAPSED_PANEL_WIDTH : clampPanelWidth(prefs.toolsWidth, TOOLS_MIN_WIDTH, toolBudget);
  const previewMaxWidth = Math.max(PREVIEW_MIN_WIDTH, Math.min(PREVIEW_MAX_WIDTH, available - toolsWidth - canvasMinimum));
  const previewWidth = wide ? (prefs.previewCollapsed ? COLLAPSED_PANEL_WIDTH : clampPanelWidth(prefs.previewWidth, PREVIEW_MIN_WIDTH, previewMaxWidth)) : available;
  const toolsMaxWidth = Math.max(TOOLS_MIN_WIDTH, Math.min(TOOLS_MAX_WIDTH, available - (wide ? previewWidth : 0) - canvasMinimum));
  return { toolsWidth, previewWidth, toolsMaxWidth, previewMaxWidth, canvasMinimum };
}
