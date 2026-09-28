import { describe, expect, it } from 'vitest';
import { COLLAPSED_PANEL_WIDTH, DEFAULT_PANEL_PREFERENCES, readPanelPreferences, resolvePanelLayout } from './panel-layout';

describe('whiteboard panel sizing', () => {
  it('keeps the familiar default widths on a wide screen', () => {
    expect(resolvePanelLayout(1440, true, DEFAULT_PANEL_PREFERENCES)).toMatchObject({ toolsWidth: 232, previewWidth: 460, canvasMinimum: 320 });
  });
  it('keeps at least 320px for the canvas when both panels grow', () => {
    for (const width of [1024, 1100, 1280, 1366, 1440, 1920]) {
      const prefs = { ...DEFAULT_PANEL_PREFERENCES, toolsWidth: 360, previewWidth: 760 };
      const before = structuredClone(prefs);
      const layout = resolvePanelLayout(width, true, prefs);
      expect(width - layout.toolsWidth - layout.previewWidth).toBeGreaterThanOrEqual(320);
      expect(layout.toolsMaxWidth + layout.previewWidth).toBeLessThanOrEqual(width - 320);
      expect(layout.previewMaxWidth + layout.toolsWidth).toBeLessThanOrEqual(width - 320);
      expect(prefs).toEqual(before);
    }
  });
  it('restores preferred widths after temporarily narrowing the window', () => {
    const prefs = { ...DEFAULT_PANEL_PREFERENCES, previewWidth: 700 };
    expect(resolvePanelLayout(1024, true, prefs).previewWidth).toBe(472);
    expect(resolvePanelLayout(1440, true, prefs).previewWidth).toBe(700);
  });
  it('collapses either panel to a reachable rail without erasing its width', () => {
    for (const key of ['toolsCollapsed', 'previewCollapsed'] as const) {
      const prefs = { ...DEFAULT_PANEL_PREFERENCES, [key]: true };
      const layout = resolvePanelLayout(1440, true, prefs);
      expect(key === 'toolsCollapsed' ? layout.toolsWidth : layout.previewWidth).toBe(COLLAPSED_PANEL_WIDTH);
      expect(prefs.toolsWidth).toBe(232);
      expect(prefs.previewWidth).toBe(460);
    }
  });
  it('uses full-width narrow preview tabs, while tools leave room for drawing', () => {
    for (const width of [320, 375, 768]) {
      const layout = resolvePanelLayout(width, false, { ...DEFAULT_PANEL_PREFERENCES, toolsWidth: 360, previewCollapsed: true });
      expect(layout.previewWidth).toBe(width);
      expect(width - layout.toolsWidth).toBeGreaterThanOrEqual(160);
    }
  });
  it('guards corrupt or invalid storage and clamps valid out-of-range widths', () => {
    for (const raw of [null, '', 'broken', 'null', '[]', '{}', '{"toolsWidth":1e999}', JSON.stringify({ ...DEFAULT_PANEL_PREFERENCES, previewWidth: null })]) {
      expect(readPanelPreferences(raw)).toEqual(DEFAULT_PANEL_PREFERENCES);
    }
    expect(readPanelPreferences(JSON.stringify({ ...DEFAULT_PANEL_PREFERENCES, toolsWidth: -4, previewWidth: 9999 })))
      .toEqual({ ...DEFAULT_PANEL_PREFERENCES, toolsWidth: 112, previewWidth: 760 });
  });
});
