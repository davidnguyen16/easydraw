/**
 * Editor Store Module
 *
 * This module is the single state hub for page metadata and persisted graph data.
 * It intentionally separates 3 different "freshness" layers:
 * 1) Canvas-local graph state in Flow.svelte (live edits while user is drawing)
 * 2) editorStoreSvelte state in this file (in-memory app state across pages)
 * 3) localStorage snapshot (explicitly saved storage state)
 */
import { browser } from '$app/environment';
import type { Edge, Node } from '@xyflow/svelte';
import { nanoid } from 'nanoid';
import { derived, get, writable } from 'svelte/store';

import { parseEasyDraw } from '$lib/exporters/easydraw';

export const editorMetaData = $state({
	fileName: 'Untitled',
	lastSaved: Date.now()
})

// A single editable page in the diagram editor.
export interface EditorPage {
	id: string;
	name: string;
	nodes: Node[];
	edges: Edge[];
}

// Global editor state: all pages + currently active page id.
export interface EditorState {
	pages: EditorPage[];
	activePageId: string;
	fileName?: string;       // Optional: persisted file name (kept optional for backward compat)
}

const STORAGE_KEY = 'easydraw.editor.v1';

// Stores the last-saved signature for each page id.
const savedPageSignaturesStore = writable<Record<string, string>>({});
// Stores pages that are dirty in the canvas but not yet synced back into editorStoreSvelte.
const canvasDirtyPageIdsStore = writable<string[]>([]);

// Creates a stable string signature for dirty-checking a page against localStorage snapshot.
function getPageSignature(page: EditorPage) {
	return JSON.stringify({
		name: page.name,
		nodes: page.nodes,
		edges: page.edges
	});
}

// Builds a signature index for all pages in a snapshot.
function buildPageSignatures(pages: EditorPage[]) {
	return pages.reduce<Record<string, string>>((acc, page) => {
		acc[page.id] = getPageSignature(page);
		return acc;
	}, {});
}

// Checks whether a value looks like a persisted editor page.
function isEditorPage(value: unknown): value is EditorPage {
	if (!value || typeof value !== 'object') return false;

	const page = value as Partial<EditorPage>;
	return (
		typeof page.id === 'string' &&
		typeof page.name === 'string' &&
		Array.isArray(page.nodes) &&
		Array.isArray(page.edges)
	);
}

// Checks whether a value looks like a persisted editor state snapshot.
function isEditorState(value: unknown): value is EditorState {
	if (!value || typeof value !== 'object') return false;

	const state = value as Partial<EditorState>;
	if (!Array.isArray(state.pages) || typeof state.activePageId !== 'string') return false;
	if (!state.pages.every(isEditorPage)) return false;
	if (state.pages.length === 0) return false;

	return state.pages.some((page) => page.id === state.activePageId);
}

// Bootstraps the editor with one default page and one starter node.
export const initialEditorState: EditorState = {
	pages: [
		{
			id: 'page-1',
			name: 'Page 1',
			nodes: [
				{
					id: '1',
					type: 'RectangleNode',
					data: { label: 'Drag nodes to the canvas' },
					position: { x: 0, y: 0 }
				}
			],
			edges: []
		}
	],
	activePageId: 'page-1'
};

// Shared writable store used by Flow, footer, and other editor UI parts.
export const editorStoreSvelte = writable<EditorState>(initialEditorState);

// List of page ids whose editor data is newer than the localStorage snapshot.
export const unsavedPageIdsStore = derived(
	[editorStoreSvelte, savedPageSignaturesStore],
	([$editorState, $savedSignatures]) => {
		return $editorState.pages
			.filter((page) => $savedSignatures[page.id] !== getPageSignature(page))
			.map((page) => page.id);
	}
);

// Combined indicator for "not saved" state: store-vs-storage OR canvas-vs-store.
export const visibleUnsavedPageIdsStore = derived(
	[unsavedPageIdsStore, canvasDirtyPageIdsStore],
	([$unsavedPageIds, $canvasDirtyPageIds]) => {
		return [...new Set([...$unsavedPageIds, ...$canvasDirtyPageIds])];
	}
);

// Marks a page as dirty in canvas-only state.
export function markCanvasDirtyPage(pageId: string) {
	canvasDirtyPageIdsStore.update((ids) => (ids.includes(pageId) ? ids : [...ids, pageId]));
}

// Clears dirty marker for a page once canvas has been synced to store.
export function clearCanvasDirtyPage(pageId: string) {
	canvasDirtyPageIdsStore.update((ids) => ids.filter((id) => id !== pageId));
}

// Clears all canvas-dirty markers, typically after reloading from storage.
export function clearAllCanvasDirtyPages() {
	canvasDirtyPageIdsStore.set([]);
}

// Saves only the currently active page into localStorage.
export function saveActivePageToStorage() {
	if (!browser) return false;

	const currentState = get(editorStoreSvelte);
	const activePage = currentState.pages.find((page) => page.id === currentState.activePageId);
	if (!activePage) return false;

	let storedState: EditorState | null = null;
	const rawState = localStorage.getItem(STORAGE_KEY);
	if (rawState) {
		try {
			const parsedState = JSON.parse(rawState) as unknown;
			storedState = isEditorState(parsedState) ? parsedState : null;
		} catch {
			storedState = null;
		}
	}

	const nextPages = storedState
		? storedState.pages.some((page) => page.id === activePage.id)
			? storedState.pages.map((page) => (page.id === activePage.id ? { ...activePage } : page))
			: [...storedState.pages, { ...activePage }]
		: [{ ...activePage }];

	const nextState: EditorState = {
		pages: nextPages,
		activePageId: activePage.id,
		fileName: editorMetaData.fileName       // Persist file name alongside pages
	};

	localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
	savedPageSignaturesStore.update((currentSignatures) => ({
		...currentSignatures,
		[activePage.id]: getPageSignature(activePage)
	}));
	clearCanvasDirtyPage(activePage.id);
	return true;
}

// Loads the full editor snapshot from localStorage and hydrates editor store.
export function loadEditorStateFromStorage() {
	if (!browser) return false;

	const rawState = localStorage.getItem(STORAGE_KEY);
	if (!rawState) return false;

	return loadEditorStateFromJSON(rawState);
}

// Loads editor state from a raw file string. Accepts both legacy plain JSON
// and the native .easydraw XML envelope (which carries the same JSON inside).
export function loadEditorStateFromJSON(rawContent: string): boolean {
	try {
		const jsonPayload = parseEasyDraw(rawContent) ?? rawContent;
		const parsedState = JSON.parse(jsonPayload) as unknown;
		if (!isEditorState(parsedState)) return false;

		editorStoreSvelte.set(parsedState);
		savedPageSignaturesStore.set(buildPageSignatures(parsedState.pages));
		clearAllCanvasDirtyPages();

		if (parsedState.fileName) {
			editorMetaData.fileName = parsedState.fileName;
		}

		return true;
	} catch {
		return false;
	}
}

// Resets editor state to a single empty page (used by File > New).
export function resetEditorState() {
	editorStoreSvelte.set({
		pages: [
			{
				id: nanoid(),
				name: 'Page 1',
				nodes: [],
				edges: []
			}
		],
		activePageId: ''
	});
	editorStoreSvelte.update((state) => ({
		...state,
		activePageId: state.pages[0].id
	}));
	savedPageSignaturesStore.set({});
	clearAllCanvasDirtyPages();
	editorMetaData.fileName = 'Untitled';
}

// Serializes the current editor state for download/clipboard.
export function exportEditorStateAsJSON(): string {
	const state = get(editorStoreSvelte);
	return JSON.stringify(
		{
			...state,
			fileName: editorMetaData.fileName
		},
		null,
		2
	);
}

// Updates the active page only when the target page id exists.
export function switchPage(pageId: string) {
	editorStoreSvelte.update((state) => {
		// Guard against invalid page ids from the UI.
		const pageExists = state.pages.some((page) => page.id === pageId);
		if (!pageExists) return state;

		return {
			...state,
			activePageId: pageId
		};
	});
}

// Creates a new page, appends it to state, and makes it the active page.
export function createPage(name?: string) {
	let createdPageId: string | null = null;

	editorStoreSvelte.update((state) => {
		// Page name can follow display order and does not need to be unique.
		const nextPageNumber = state.pages.length + 1;

		// Page id must be globally unique for stable references.
		const pageId = nanoid();
		const pageName = name?.trim() || `Page ${nextPageNumber}`;

		const newPage: EditorPage = {
			id: pageId,
			name: pageName,
			nodes: [],
			edges: []
		};
		createdPageId = newPage.id;

		return {
			...state,
			pages: [...state.pages, newPage],
			activePageId: newPage.id
		};
	});

	// Returns the new id so UI can hydrate the just-created page immediately.
	return createdPageId;
}

// Updates graph content (nodes + edges) for the currently active page.
export function updateActiveGraph(nodes: Node[], edges: Edge[]) {
	editorStoreSvelte.update((state) => {
		const activePageExists = state.pages.some((page) => page.id === state.activePageId);
		if (!activePageExists) return state;

		return {
			...state,
			pages: state.pages.map((page) =>
				page.id === state.activePageId
					? {
							...page,
							nodes: [...nodes],
							edges: [...edges]
						}
					: page
			)
		};
	});
}

// Renames a page by id using the exact text from inline page-name input.
export function renamePage(pageId: string, nextName: string) {
	editorStoreSvelte.update((state) => ({
		...state,
		pages: state.pages.map((page) =>
			page.id === pageId
				? {
						...page,
						name: nextName
					}
				: page
		)
	}));
}

// Deletes a page by id while keeping at least one page alive.
export function deletePage(pageId: string) {
	editorStoreSvelte.update((state) => {
		const pageExists = state.pages.some((page) => page.id === pageId);
		if (!pageExists) return state;
		if (state.pages.length <= 1) return state;

		const nextPages = state.pages.filter((page) => page.id !== pageId);
		const nextActivePageId =
			state.activePageId === pageId ? nextPages[0]?.id ?? state.activePageId : state.activePageId;

		return {
			...state,
			pages: nextPages,
			activePageId: nextActivePageId
		};
	});
	clearCanvasDirtyPage(pageId);
}

// Persists the complete in-memory editor state to localStorage (full overwrite).
// Use this after operations that restructure the page list — e.g. page deletion —
// so that a page removed from the store also disappears from the persisted snapshot.
// Unlike saveActivePageToStorage (which merges only the active page), this
// unconditionally overwrites localStorage with whatever is currently in the store.
// Canvas-only dirty markers are intentionally left untouched; if the active page
// has unsaved canvas changes the dirty dot will keep showing via canvasDirtyPageIdsStore.
export function saveFullStateToStorage() {
	if (!browser) return false;

	const currentState = get(editorStoreSvelte);
	const nextState: EditorState = {
		...currentState,
		fileName: editorMetaData.fileName
	};

	localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
	// Bring savedPageSignatures in sync with what is now in localStorage so that
	// the "unsaved changes" indicator correctly reflects the true save state.
	savedPageSignaturesStore.set(buildPageSignatures(currentState.pages));
	return true;
}

// Read-only store for the currently active page object.
// If activePageId is stale, it falls back to the first page and repairs the id in editorStoreSvelte.
export const activePageStore = derived(editorStoreSvelte, ($editorState, set) => {
	const activePage = $editorState.pages.find((page) => page.id === $editorState.activePageId);
	if (activePage) {
		set(activePage);
		return;
	}

	const fallbackPage = $editorState.pages[0] ?? null;
	set(fallbackPage);

	// Keep source state consistent with the fallback page.
	if (fallbackPage && $editorState.activePageId !== fallbackPage.id) {
		editorStoreSvelte.update((state) => ({
			...state,
			activePageId: fallbackPage.id
		}));
	}
});