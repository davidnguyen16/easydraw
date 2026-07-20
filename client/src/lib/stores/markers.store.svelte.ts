/**
 * Marker Palette Store
 *
 * Holds which line-ending kinds (from the MARKER_DEFS catalog) are offered in
 * the connection panel's Start/End dropdowns. Edited through the "Line
 * endings" dialog (More → tick / untick → Apply) and persisted to
 * localStorage so the choice survives reloads.
 *
 * This is an app-level PREFERENCE: disabling a marker only hides it from the
 * dropdowns — edges already using it keep rendering it.
 */
import { browser } from '$app/environment';
import { MARKER_DEFS } from '$lib/flow/edges/markers';

const STORAGE_KEY = 'easydraw.line-endings.v1';

// Default: everything in the catalog is available.
export const markerPalette = $state<{ enabled: string[] }>({
	enabled: MARKER_DEFS.map((d) => d.id)
});

// Commits a new enabled set (dialog Apply) and persists it.
export function setEnabledMarkers(ids: string[]) {
	const valid = new Set<string>(MARKER_DEFS.map((d) => d.id));
	markerPalette.enabled = ids.filter((id) => valid.has(id));
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(markerPalette.enabled));
	} catch {
		// Fail silently if storage is unavailable.
	}
}

// Hydrate from localStorage at module init. Unknown ids (from an older
// catalog version) are dropped; bad data falls back to the default silently.
function loadMarkerPalette() {
	if (!browser) return;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) return;
		const valid = new Set<string>(MARKER_DEFS.map((d) => d.id));
		markerPalette.enabled = parsed.filter((id) => valid.has(id));
	} catch {
		// Fail silently if storage is unavailable or data is corrupted.
	}
}

loadMarkerPalette();
