/**
 * Shared UI icon registry for the menubar / toolbar (24×24 stroke icons).
 * Each entry is the icon's inner SVG markup; UiIcon.svelte wraps it in the
 * common <svg> shell (viewBox, currentColor stroke, round caps). One source
 * of truth — MenuBar and ToolBar used to duplicate several of these inline.
 */
export const ICON_PATHS: Record<string, string> = {
	// ── file ─────────────────────────────────────────────────────────────
	new: `<path d="M8 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 7 20v-5.5" />
		<path d="M15 3.5V8h4" />
		<path d="M4 7.5h6" />
		<path d="M7 4.5v6" />`,
	open: `<path d="M3.5 7.5h6l2 2h9" />
		<path d="M3.5 7.5v11a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.45-1.1l1.05-6.4H7.5L6 15" />`,
	save: `<path d="M5 3.5h12l2 2V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20z" />
		<path d="M8 3.5V9h7V3.5" />
		<path d="M8 21.5v-7h8v7" />
		<path d="M14 6.5h1" />`,
	'save-as': `<path d="M8 3.5h8l3 3V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6.5 3.5H8z" />
		<path d="M16 3.5V7h3" />
		<path d="M12 9.5v7" />
		<path d="M9.5 14 12 16.5 14.5 14" />
		<path d="M9 18.5h6" />`,
	export: `<path d="M12 17V5" />
		<path d="M8 9l4-4 4 4" />
		<path d="M5 15.5V20h14v-4.5" />`,

	// ── edit ─────────────────────────────────────────────────────────────
	undo: `<polyline points="9 14 4 9 9 4" />
		<path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5h-4" />`,
	redo: `<polyline points="15 14 20 9 15 4" />
		<path d="M20 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h4" />`,
	cut: `<circle cx="6" cy="6" r="3" />
		<circle cx="6" cy="18" r="3" />
		<line x1="20" y1="4" x2="8.12" y2="15.88" />
		<line x1="14.47" y1="14.48" x2="20" y2="20" />
		<line x1="8.12" y1="8.12" x2="12" y2="12" />`,
	copy: `<rect x="9" y="9" width="11" height="11" rx="2" />
		<path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />`,
	duplicate: `<rect x="9" y="9" width="11" height="11" rx="2" />
		<path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
		<line x1="12" y1="12" x2="17" y2="12" />
		<line x1="14.5" y1="9.5" x2="14.5" y2="14.5" />`,
	paste: `<rect x="8" y="3" width="8" height="3" rx="1" />
		<path d="M16 5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />`,
	'select-all': `<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="2 3" />
		<line x1="9" y1="12" x2="15" y2="12" />
		<line x1="12" y1="9" x2="12" y2="15" />`,
	delete: `<polyline points="3 6 5 6 21 6" />
		<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
		<path d="M10 11v6" />
		<path d="M14 11v6" />
		<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />`,

	// ── view / zoom ──────────────────────────────────────────────────────
	'zoom-in': `<circle cx="11" cy="11" r="7" />
		<line x1="20" y1="20" x2="16" y2="16" />
		<line x1="11" y1="8" x2="11" y2="14" />
		<line x1="8" y1="11" x2="14" y2="11" />`,
	'zoom-out': `<circle cx="11" cy="11" r="7" />
		<line x1="20" y1="20" x2="16" y2="16" />
		<line x1="8" y1="11" x2="14" y2="11" />`,
	fit: `<polyline points="4 9 4 4 9 4" />
		<polyline points="20 9 20 4 15 4" />
		<polyline points="4 15 4 20 9 20" />
		<polyline points="20 15 20 20 15 20" />`,
	fullscreen: `<polyline points="9 4 4 4 4 9" />
		<polyline points="15 4 20 4 20 9" />
		<polyline points="9 20 4 20 4 15" />
		<polyline points="15 20 20 20 20 15" />`,

	// ── arrange ──────────────────────────────────────────────────────────
	'bring-front': `<path d="M12 3l9 4-9 4-9-4 9-4z" />
		<path d="M3 12l9 4 9-4" />
		<path d="M3 17l9 4 9-4" opacity="0.45" />`,
	'send-back': `<path d="M3 7l9-4 9 4-9 4-9-4z" opacity="0.45" />
		<path d="M3 12l9 4 9-4" opacity="0.7" />
		<path d="M3 17l9 4 9-4" />`,
	group: `<rect x="3" y="3" width="11" height="11" rx="1.5" />
		<rect x="10" y="10" width="11" height="11" rx="1.5" />`,
	ungroup: `<rect x="3" y="3" width="9" height="9" rx="1" stroke-dasharray="2 2" />
		<rect x="12" y="12" width="9" height="9" rx="1" stroke-dasharray="2 2" />`,

	// ── object / lock ────────────────────────────────────────────────────
	'lock-closed': `<rect x="5" y="11" width="14" height="10" rx="2" />
		<path d="M8 11V7a4 4 0 0 1 8 0v4" />`,
	'lock-open': `<rect x="5" y="11" width="14" height="10" rx="2" />
		<path d="M8 11V7a4 4 0 0 1 7.5 -2" />`,

	// ── misc ─────────────────────────────────────────────────────────────
	check: `<polyline points="5 12 10 17 19 8" />`,
	chevron: `<polyline points="6 9 12 15 18 9" />`,
	'chevron-right': `<polyline points="9 6 15 12 9 18" />`,
	info: `<circle cx="12" cy="12" r="9" />
		<line x1="12" y1="8" x2="12" y2="8" />
		<line x1="12" y1="11" x2="12" y2="16" />`,
	keyboard: `<rect x="2" y="6" width="20" height="12" rx="2" />
		<line x1="6" y1="10" x2="6" y2="10" />
		<line x1="10" y1="10" x2="10" y2="10" />
		<line x1="14" y1="10" x2="14" y2="10" />
		<line x1="18" y1="10" x2="18" y2="10" />
		<line x1="7" y1="14" x2="17" y2="14" />`,
	// Panel-right layout: outlined window, right column solid — matches the
	// Lucid-style reference; reads clearly at 18px unlike the dotted variant.
	'style-panel': `<rect x="3.5" y="4" width="17" height="16" rx="2" />
		<path d="M14.5 4H18.5A2 2 0 0 1 20.5 6V18A2 2 0 0 1 18.5 20H14.5Z" fill="currentColor" stroke="none" />`
};
