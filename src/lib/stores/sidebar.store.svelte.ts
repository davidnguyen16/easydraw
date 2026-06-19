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
 *
 * State:
 * - sidebarState: { width: number, isCollapsed: boolean }
 *   Reactive $state proxy. Components read width/isCollapsed directly.
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
export const DEFAULT_WIDTH = 300;
export const COLLAPSE_THRESHOLD = 80;

const STORAGE_KEY = 'easydraw.sidebar.v1';

interface SidebarSnapshot {
	width: number;
	isCollapsed: boolean;
}

// Reactive panel state shared by Sidebar.svelte and its children.
export const sidebarState = $state<SidebarSnapshot>({
	width: DEFAULT_WIDTH,
	isCollapsed: false
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
