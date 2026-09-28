import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PANEL_PREFERENCES, PANEL_LAYOUT_STORAGE_KEY } from './panel-layout';
import { useWhiteboardPanelLayout } from './panel-layout.store';

const storage = { getItem: vi.fn(), setItem: vi.fn() };
beforeEach(() => {
  storage.getItem.mockReset().mockReturnValue(null);
  storage.setItem.mockReset();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', storage);
  useWhiteboardPanelLayout.setState({ ...DEFAULT_PANEL_PREFERENCES, loaded: false });
});
afterEach(() => vi.unstubAllGlobals());

describe('whiteboard layout preferences', () => {
  it('loads once from its own key and keeps runtime adjustments', () => {
    storage.getItem.mockReturnValue(JSON.stringify({ ...DEFAULT_PANEL_PREFERENCES, toolsWidth: 180, previewCollapsed: true }));
    const state = useWhiteboardPanelLayout.getState();
    state.load();
    expect(storage.getItem).toHaveBeenCalledWith(PANEL_LAYOUT_STORAGE_KEY);
    expect(useWhiteboardPanelLayout.getState()).toMatchObject({ toolsWidth: 180, previewCollapsed: true, loaded: true });
    state.setWidth('tools', 220);
    state.load();
    expect(useWhiteboardPanelLayout.getState().toolsWidth).toBe(220);
    expect(storage.getItem).toHaveBeenCalledOnce();
  });
  it('does not persist pointer-move widths until explicitly committed', () => {
    const state = useWhiteboardPanelLayout.getState();
    state.setWidth('tools', 280);
    state.setWidth('preview', 600);
    expect(storage.setItem).not.toHaveBeenCalled();
    state.persist();
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(PANEL_LAYOUT_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_PANEL_PREFERENCES, toolsWidth: 280, previewWidth: 600 }));
  });
  it('preserves both remembered widths across collapse/reopen', () => {
    const state = useWhiteboardPanelLayout.getState();
    state.toggle('tools');
    state.toggle('preview');
    expect(useWhiteboardPanelLayout.getState()).toMatchObject({ ...DEFAULT_PANEL_PREFERENCES, toolsCollapsed: true, previewCollapsed: true });
    state.toggle('tools');
    state.toggle('preview');
    expect(useWhiteboardPanelLayout.getState()).toMatchObject(DEFAULT_PANEL_PREFERENCES);
    expect(storage.setItem.mock.calls.every(([key]) => key === PANEL_LAYOUT_STORAGE_KEY)).toBe(true);
  });
  it('rejects non-finite sizes and remains usable when browser storage is denied', () => {
    storage.getItem.mockImplementation(() => { throw new Error('Storage unavailable'); });
    storage.setItem.mockImplementation(() => { throw new Error('Storage unavailable'); });
    const state = useWhiteboardPanelLayout.getState();
    expect(() => state.load()).not.toThrow();
    state.setWidth('tools', NaN);
    state.setWidth('preview', Infinity);
    expect(useWhiteboardPanelLayout.getState()).toMatchObject(DEFAULT_PANEL_PREFERENCES);
    expect(() => state.toggle('tools')).not.toThrow();
    expect(useWhiteboardPanelLayout.getState().toolsCollapsed).toBe(true);
    expect(() => state.persist()).not.toThrow();
  });
});
