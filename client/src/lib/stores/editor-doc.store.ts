/**
 * Editor document store (Zustand port of editor.store.svelte.ts).
 *
 * Single state hub for page metadata and persisted graph data. It keeps 3
 * "freshness" layers separate:
 *  1) Canvas-local graph state in flow-store (live edits while drawing)
 *  2) This store's pages[] (in-memory app state across pages)
 *  3) localStorage snapshot (explicitly saved storage state)
 *
 * The cloud copy (PATCH /diagrams/:id, data JSONB = EditorState) is driven by
 * the editor page + Flow autosave, not this module.
 */
import type { Edge, Node } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { parseEasyDraw } from '@/lib/exporters/easydraw';
import { useEditorMeta, type DiagramStatus } from '@/lib/stores/editor-meta.store';

const browser = typeof window !== 'undefined';

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
  fileName?: string;
  status?: DiagramStatus;
}

const STORAGE_KEY = 'easydraw.editor.v1';

/**
 * Diagrams saved by the SvelteKit app stored `node.style` as a CSS *string*
 * (`"width: 150px; height: 70px;"`). React expects a CSSProperties object — a
 * string makes React assign into CSSStyleDeclaration by index and throw
 * "Failed to set an indexed property [0]", which kills the whole render.
 * Convert on the way in so existing documents keep working.
 */
function parseStyleString(style: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const declaration of style.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator === -1) continue;
    const property = declaration.slice(0, separator).trim();
    const value = declaration.slice(separator + 1).trim();
    if (!property || !value) continue;
    // `background-color` -> `backgroundColor`
    parsed[property.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())] = value;
  }
  return parsed;
}

function normalizePageNodes(page: EditorPage): EditorPage {
  if (!page.nodes.some((node) => typeof node.style === 'string')) return page;
  return {
    ...page,
    nodes: page.nodes.map((node) =>
      typeof node.style === 'string'
        ? { ...node, style: parseStyleString(node.style) as Node['style'] }
        : node,
    ),
  };
}

// Creates a stable string signature for dirty-checking a page against a snapshot.
export function getPageSignature(page: EditorPage) {
  return JSON.stringify({ name: page.name, nodes: page.nodes, edges: page.edges });
}

function buildPageSignatures(pages: EditorPage[]) {
  return pages.reduce<Record<string, string>>((acc, page) => {
    acc[page.id] = getPageSignature(page);
    return acc;
  }, {});
}

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

function isEditorState(value: unknown): value is EditorState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<EditorState>;
  if (!Array.isArray(state.pages) || typeof state.activePageId !== 'string') return false;
  if (!state.pages.every(isEditorPage)) return false;
  if (state.pages.length === 0) return false;
  return state.pages.some((page) => page.id === state.activePageId);
}

function isDiagramStatus(value: unknown): value is DiagramStatus {
  return value === 'draft' || value === 'complete' || value === 'archived';
}

// Bootstraps the editor with one empty default page (no starter/demo node).
export const initialEditorState: EditorState = {
  pages: [{ id: 'page-1', name: 'Page 1', nodes: [], edges: [] }],
  activePageId: 'page-1',
};

type EditorDocStore = {
  pages: EditorPage[];
  activePageId: string;
  savedPageSignatures: Record<string, string>;
  canvasDirtyPageIds: string[];

  markCanvasDirtyPage: (pageId: string) => void;
  clearCanvasDirtyPage: (pageId: string) => void;
  clearAllCanvasDirtyPages: () => void;

  switchPage: (pageId: string) => void;
  createPage: (name?: string) => string | null;
  updateActiveGraph: (nodes: Node[], edges: Edge[]) => void;
  renamePage: (pageId: string, nextName: string) => void;
  deletePage: (pageId: string) => void;
  duplicatePage: (pageId: string) => string | null;
  deleteAllPages: () => void;
  resetEditorState: () => void;
  loadEditorStateFromJSON: (rawContent: string) => boolean;
};

export const useEditorDoc = create<EditorDocStore>((set, get) => ({
  pages: initialEditorState.pages,
  activePageId: initialEditorState.activePageId,
  savedPageSignatures: {},
  canvasDirtyPageIds: [],

  markCanvasDirtyPage: (pageId) =>
    set((s) => (s.canvasDirtyPageIds.includes(pageId) ? s : { canvasDirtyPageIds: [...s.canvasDirtyPageIds, pageId] })),
  clearCanvasDirtyPage: (pageId) =>
    set((s) => ({ canvasDirtyPageIds: s.canvasDirtyPageIds.filter((id) => id !== pageId) })),
  clearAllCanvasDirtyPages: () => set({ canvasDirtyPageIds: [] }),

  switchPage: (pageId) =>
    set((s) => (s.pages.some((page) => page.id === pageId) ? { activePageId: pageId } : s)),

  createPage: (name) => {
    let createdPageId: string | null = null;
    set((s) => {
      const nextPageNumber = s.pages.length + 1;
      const pageId = nanoid();
      const pageName = name?.trim() || `Page ${nextPageNumber}`;
      const newPage: EditorPage = { id: pageId, name: pageName, nodes: [], edges: [] };
      createdPageId = newPage.id;
      return { pages: [...s.pages, newPage], activePageId: newPage.id };
    });
    return createdPageId;
  },

  updateActiveGraph: (nodes, edges) =>
    set((s) => {
      if (!s.pages.some((page) => page.id === s.activePageId)) return s;
      return {
        pages: s.pages.map((page) =>
          page.id === s.activePageId ? { ...page, nodes: [...nodes], edges: [...edges] } : page,
        ),
      };
    }),

  renamePage: (pageId, nextName) =>
    set((s) => ({
      pages: s.pages.map((page) => (page.id === pageId ? { ...page, name: nextName } : page)),
    })),

  deletePage: (pageId) => {
    set((s) => {
      if (!s.pages.some((page) => page.id === pageId)) return s;
      if (s.pages.length <= 1) return s;
      const nextPages = s.pages.filter((page) => page.id !== pageId);
      const nextActivePageId =
        s.activePageId === pageId ? (nextPages[0]?.id ?? s.activePageId) : s.activePageId;
      return { pages: nextPages, activePageId: nextActivePageId };
    });
    get().clearCanvasDirtyPage(pageId);
  },

  duplicatePage: (pageId) => {
    let newPageId: string | null = null;
    set((s) => {
      const index = s.pages.findIndex((page) => page.id === pageId);
      if (index === -1) return s;
      const source = s.pages[index];

      // "<name> (2)", "<name> (3)", … — escape regex chars in the page name.
      const escaped = source.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const suffixPattern = new RegExp(`^${escaped} \\((\\d+)\\)$`);
      let maxSuffix = 1;
      for (const page of s.pages) {
        const match = page.name.match(suffixPattern);
        if (match) maxSuffix = Math.max(maxSuffix, Number.parseInt(match[1], 10));
      }

      // JSON clone (not structuredClone): node data may hold live function
      // closures (e.g. onEdit) that structuredClone throws on.
      const clone: EditorPage = {
        id: nanoid(),
        name: `${source.name} (${maxSuffix + 1})`,
        nodes: JSON.parse(JSON.stringify(source.nodes ?? [])) as Node[],
        edges: JSON.parse(JSON.stringify(source.edges ?? [])) as Edge[],
      };
      newPageId = clone.id;

      const nextPages = [...s.pages];
      nextPages.splice(index + 1, 0, clone);
      return { pages: nextPages, activePageId: clone.id };
    });
    return newPageId;
  },

  deleteAllPages: () => {
    const page: EditorPage = { id: nanoid(), name: 'Page 1', nodes: [], edges: [] };
    set({ pages: [page], activePageId: page.id, canvasDirtyPageIds: [] });
  },

  resetEditorState: () => {
    const page: EditorPage = { id: nanoid(), name: 'Page 1', nodes: [], edges: [] };
    set({ pages: [page], activePageId: page.id, savedPageSignatures: {}, canvasDirtyPageIds: [] });
    const meta = useEditorMeta.getState();
    meta.setFileName('Untitled');
    meta.setStatus('draft');
  },

  loadEditorStateFromJSON: (rawContent) => {
    try {
      const jsonPayload = parseEasyDraw(rawContent) ?? rawContent;
      const parsedState = JSON.parse(jsonPayload) as unknown;
      if (!isEditorState(parsedState)) return false;

      const pages = parsedState.pages.map(normalizePageNodes);
      set({
        pages,
        activePageId: parsedState.activePageId,
        savedPageSignatures: buildPageSignatures(pages),
        canvasDirtyPageIds: [],
      });

      const meta = useEditorMeta.getState();
      if (parsedState.fileName) meta.setFileName(parsedState.fileName);
      meta.setStatus(isDiagramStatus(parsedState.status) ? parsedState.status : 'draft');
      return true;
    } catch {
      return false;
    }
  },
}));

// ── Derived selectors ──

// Page ids whose editor data is newer than the localStorage snapshot.
function getUnsavedPageIds(s: EditorDocStore): string[] {
  return s.pages.filter((p) => s.savedPageSignatures[p.id] !== getPageSignature(p)).map((p) => p.id);
}

// Combined "not saved" set: store-vs-storage OR canvas-vs-store.
export function computeVisibleUnsavedPageIds(s: EditorDocStore): string[] {
  return [...new Set([...getUnsavedPageIds(s), ...s.canvasDirtyPageIds])];
}

// Reactive hook for the footer dirty-dots (shallow-compared so a new array with
// the same ids doesn't re-render).
export const useVisibleUnsavedPageIds = () =>
  useEditorDoc(useShallow((s) => computeVisibleUnsavedPageIds(s)));

export function getActivePage(s: Pick<EditorDocStore, 'pages' | 'activePageId'>): EditorPage | null {
  return s.pages.find((page) => page.id === s.activePageId) ?? s.pages[0] ?? null;
}

// ── localStorage persistence (module helpers, not store actions) ──

// Saves only the currently active page into localStorage.
export function saveActivePageToStorage(): boolean {
  if (!browser) return false;
  const state = useEditorDoc.getState();
  const meta = useEditorMeta.getState();
  const activePage = state.pages.find((page) => page.id === state.activePageId);
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
    fileName: meta.fileName,
    status: meta.status,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  useEditorDoc.setState((s) => ({
    savedPageSignatures: { ...s.savedPageSignatures, [activePage.id]: getPageSignature(activePage) },
  }));
  useEditorDoc.getState().clearCanvasDirtyPage(activePage.id);
  return true;
}

// Persists the complete in-memory editor state to localStorage (full overwrite).
export function saveFullStateToStorage(): boolean {
  if (!browser) return false;
  const state = useEditorDoc.getState();
  const meta = useEditorMeta.getState();
  const nextState: EditorState = {
    pages: state.pages,
    activePageId: state.activePageId,
    fileName: meta.fileName,
    status: meta.status,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  useEditorDoc.setState({ savedPageSignatures: buildPageSignatures(state.pages) });
  return true;
}

// Loads the full editor snapshot from localStorage and hydrates the store.
export function loadEditorStateFromStorage(): boolean {
  if (!browser) return false;
  const rawState = localStorage.getItem(STORAGE_KEY);
  if (!rawState) return false;
  return useEditorDoc.getState().loadEditorStateFromJSON(rawState);
}

// Serializes the current editor state for download/clipboard.
export function exportEditorStateAsJSON(): string {
  const state = useEditorDoc.getState();
  const meta = useEditorMeta.getState();
  return JSON.stringify(
    {
      pages: state.pages,
      activePageId: state.activePageId,
      fileName: meta.fileName,
      status: meta.status,
    },
    null,
    2,
  );
}
