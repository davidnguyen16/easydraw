/**
 * Sidebar Store Module
 *
 * Manages the left sidebar panel's resize/collapse state.
 *
 * Public API contract (exported symbols)
 * --------------------------------------
 *
 * Constants:
 * - MIN_WIDTH: number          Minimum expanded width in px.
 * - MAX_WIDTH: number          Maximum expanded width in px.
 * - DEFAULT_WIDTH: number      Width used when no persisted snapshot exists.
 * - COLLAPSE_THRESHOLD: number Drag-width below this auto-collapses the panel.
 * - SIDEBAR_RESIZE_HANDLE_OVERHANG_PX: number
 *   Extra hit area extending beyond the visible sidebar edge.
 *
 * State:
 * - sidebarState: { width, isCollapsed, isResizing, renderedWidth }
 *   Reactive $state proxy. `renderedWidth` follows the actual animated DOM
 *   width and is intentionally not persisted.
 *
 * Mutators:
 * - setWidth(nextWidth: number): void
 *   Clamps input to [MIN_WIDTH, MAX_WIDTH] and updates width.
 *   If input < COLLAPSE_THRESHOLD, auto-collapses without changing width.
 *
 * - toggleCollapse(): void
 *   Flips isCollapsed. Width is preserved across toggles.
 *
 * - expand(): void
 *   Forces isCollapsed = false. Used by CollapseButton when reopening.
 *
 * Persistence:
 * - persistSidebarState(): void
 *   Writes current state to localStorage. Caller-driven (call on drag end /
 *   on collapse toggle) so we avoid flooding storage during live drag.
 *
 * - loadSidebarStateFromStorage(): void
 *   Reads + validates snapshot. Falls back silently to defaults on bad data.
 */

import { browser } from '$app/environment';

export const MIN_WIDTH = 80;
export const MAX_WIDTH = 600;
// 220px opens the palette on 3 comfortable ~55px columns (Lucidchart-like).
export const DEFAULT_WIDTH = 220;
export const COLLAPSE_THRESHOLD = 80;
/** Resize hit area extends this far beyond the visible sidebar edge. */
export const SIDEBAR_RESIZE_HANDLE_OVERHANG_PX = 3;

const STORAGE_KEY = 'easydraw.sidebar.v1';

interface SidebarSnapshot {
	width: number;
	isCollapsed: boolean;
}

// Full runtime state = persisted snapshot + transient flags.
// `isResizing` is true only while the user is dragging the resize handle:
// Sidebar suppresses its width transition then, so the panel edge tracks
// the cursor 1:1 (no rubber-band lag) — the animation only plays for
// collapse/expand toggles. `renderedWidth` follows those transition frames so
// overlay-aware canvas navigation remains aligned. Neither field is persisted.
interface SidebarState extends SidebarSnapshot {
	isResizing: boolean;
	/** Actual rendered width, including intermediate CSS-transition frames. */
	renderedWidth: number;
}

// Reactive panel state shared by Sidebar.svelte and its children.
export const sidebarState = $state<SidebarState>({
	width: DEFAULT_WIDTH,
	isCollapsed: false,
	isResizing: false,
	renderedWidth: DEFAULT_WIDTH
});

// Validates a parsed localStorage payload before applying it.
function isSidebarSnapshot(value: unknown): value is SidebarSnapshot {
	if (!value || typeof value !== 'object') return false;
	const snapshot = value as Partial<SidebarSnapshot>;
	return typeof snapshot.width === 'number' && typeof snapshot.isCollapsed === 'boolean';
}

// Clamps a value into [min, max] inclusive
function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

// Applies a new width with clamping and auto-collapse logic
export function setWidth(nextWidth: number) {
	// Dragging below the collapse threshold auto-collapses the sidebar without changing width.
	if (nextWidth < COLLAPSE_THRESHOLD) {
		sidebarState.isCollapsed = true;
		return;
	}

	sidebarState.width = clamp(nextWidth, MIN_WIDTH, MAX_WIDTH);
	sidebarState.isCollapsed = false;
}

// Flips the collapsed state. Width is preserved the last expanded width.
export function toggleCollapse() {
	sidebarState.isCollapsed = !sidebarState.isCollapsed;
}

// Forces the sidebar open; used when user clicks the reopen knob.
export function expand() {
	sidebarState.isCollapsed = false;
}

// Persists current sidebar state to localStorage. No operations outside the browser.
export function persistSidebarState() {
	if (!browser) return;
	const snapshot: SidebarSnapshot = {
		width: sidebarState.width,
		isCollapsed: sidebarState.isCollapsed
	};
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
	} catch {
		// Fail silently if storage is unavailable.
	}
}

// Loads sidebar state from localStorage if valid. Otherwise, silently falls back to defaults.
export function loadSidebarStateFromStorage() {
	if (!browser) return;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as unknown;
		if (!isSidebarSnapshot(parsed)) return;
		sidebarState.width = clamp(parsed.width, MIN_WIDTH, MAX_WIDTH);
		sidebarState.isCollapsed = parsed.isCollapsed;
	} catch {
		// Fail silently if storage is unavailable or data is corrupted.
	}
}
