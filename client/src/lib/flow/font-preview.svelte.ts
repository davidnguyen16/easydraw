// Ephemeral text-style preview for the font / size dropdowns (Text-tab panel
// AND the toolbar).
//
// Hovering a font or size option should paint the *selected* node's label with
// that value immediately — but only as a preview: moving away reverts, and only
// a click commits. To avoid polluting undo history / autosave, the preview must
// NOT touch node/edge data. Instead the hovered value(s) are parked here, keyed
// by the target's id (a node OR an edge — the toolbar styles whichever is
// selected). Every text-bearing renderer (ShapeNode, EntityNode, NetworkNode,
// ConnectionEdge labels) reads this override for display and falls back to its
// real committed value for any field the preview doesn't set (or when it targets
// something else). Each preview carries only the field(s) being hovered — e.g.
// hovering a size sets `fontSize` only, leaving the committed `fontFamily`.
export const fontPreview = $state<{
	value: { targetId: string; fontFamily?: string; fontSize?: number } | null;
}>({
	value: null
});
