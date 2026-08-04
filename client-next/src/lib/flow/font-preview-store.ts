import { create } from 'zustand';

// Ephemeral text-style preview for the font / size dropdowns (Text-tab panel
// AND the toolbar) — ported from the SvelteKit client's font-preview store.
//
// Hovering a font or size option should paint the *selected* target's label
// with that value immediately — but only as a preview: moving away reverts, and
// only a click commits. To avoid polluting undo history / autosave, the preview
// must NOT touch node/edge data. Instead the hovered value(s) are parked here,
// keyed by the target's id (a node OR an edge). Every text-bearing renderer
// reads this override and falls back to its committed value for any field the
// preview doesn't set (or when it targets something else).
export type FontPreviewValue = {
  targetId: string;
  fontFamily?: string;
  fontSize?: number;
} | null;

type FontPreviewState = {
  value: FontPreviewValue;
  setPreview: (value: FontPreviewValue) => void;
};

export const useFontPreviewStore = create<FontPreviewState>((set) => ({
  value: null,
  setPreview: (value) => set({ value }),
}));
