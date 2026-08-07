import { create } from 'zustand';
import { MARKER_DEFS } from '@/lib/flow/edges/markers';

/**
 * Marker Palette Store — which line-ending kinds (from MARKER_DEFS) are offered
 * in the connection panel's Start/End dropdowns. Edited via the "Line endings"
 * dialog and persisted to localStorage. Disabling a marker only hides it from
 * the dropdowns — edges already using it keep rendering it. (Zustand port of the
 * SvelteKit `markers.store.svelte.ts`.)
 */
const STORAGE_KEY = 'easydraw.line-endings.v1';

function loadEnabled(): string[] {
  const all = MARKER_DEFS.map((d) => d.id);
  if (typeof window === 'undefined') return all;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return all;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) return all;
    const valid = new Set<string>(all);
    return (parsed as string[]).filter((id) => valid.has(id));
  } catch {
    return all;
  }
}

type MarkerPaletteState = {
  enabled: string[];
  setEnabledMarkers: (ids: string[]) => void;
};

export const useMarkerPalette = create<MarkerPaletteState>((set) => ({
  enabled: loadEnabled(),
  setEnabledMarkers: (ids) => {
    const valid = new Set<string>(MARKER_DEFS.map((d) => d.id));
    const enabled = ids.filter((id) => valid.has(id));
    set({ enabled });
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
    } catch {
      // Fail silently if storage is unavailable.
    }
  },
}));
