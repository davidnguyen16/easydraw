/**
 * Editor persistence engine (port of Flow.svelte's sync + autosave logic).
 *
 * The Svelte editor kept this state in Flow.svelte's script; here it lives at
 * module scope because every store it touches is a global Zustand store reached
 * via getState(). The reactive triggers (canvas / metadata change → autosave)
 * run from <DiagramPersistence/>; everything else is imperative and callable
 * from the editor context (save / export / page ops).
 *
 * Three freshness layers, same as Svelte:
 *   1) flow-store  — live canvas graph
 *   2) editor-doc  — pages[] (in-memory app state)
 *   3) localStorage + cloud (PATCH /diagrams/:id, data JSONB = EditorState)
 */
import { getNodesBounds, type Node, type Edge } from '@xyflow/react';
import { useFlowStore } from '@/lib/flow/flow-store';
import {
  useEditorDoc,
  getActivePage,
  getPageSignature,
  savePageToStorage,
  saveFullStateToStorage,
  exportEditorStateAsJSON,
  computeVisibleUnsavedPageIds,
  type EditorState,
} from '@/lib/stores/editor-doc.store';
import { useEditorMeta } from '@/lib/stores/editor-meta.store';
import { useEditorStore } from '@/lib/stores/editor.store';
import { useImportReport } from '@/lib/stores/import-report.store';
import { detectFormat, importDiagram, IMPORT_FORMAT_LABELS } from '@easydraw/diagram-import';
import { resetHistory, setApplyingHistory } from '@/lib/stores/history.store';
import { getExporter } from '@/lib/exporters';
import { captureThumbnailCanvas } from '@/lib/exporters/canvas-capture';
import { encodeThumbnail, THUMBNAIL_MAX_HEIGHT, THUMBNAIL_MAX_WIDTH, uploadThumbnail } from '@/lib/thumbnails';
import type { ExportBounds, ExportContext } from '@/lib/exporters/types';
import { API_URL } from '@/lib/api';
import { graphHistorySnapshot, isGraphGestureActive } from './editor-commands';
import { KeyedSaveQueue } from './save-queue';

// ── Module state (one editor instance at a time) ──
let baselineCanvasSignature = '';
let canvasPageId: string | null = null;
let isHydrating = false;
let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
let saveGeneration = 0;
let savedMetaSignature: string | null = null;
let activeDiagramId: string | null = null;
const saveQueue = new KeyedSaveQueue();

function canMutateDocument() {
  const state = useEditorStore.getState();
  return !state.locked && !state.presenting && !isGraphGestureActive();
}

interface SaveRequest {
  diagramId: string;
  generation: number;
  metaSignature: string;
  canvasSignature: string;
  pageId: string | null;
  pageSignatures: Record<string, string>;
  body: string;
}
let pendingSave: SaveRequest | null = null;

/** Bind global editor stores to the mounted document, never a previous route. */
export function startDiagramPersistence(diagramId: string) {
  activeDiagramId = diagramId;
  ++saveGeneration;
  // The document was just loaded from the server, so its title/status/page
  // list is the saved baseline. Only this and a confirmed save may set it:
  // the metadata effect bails out while hydrating and (unlike Svelte's
  // auto-tracked $effect) never re-runs when the flag clears, so a baseline
  // taken later would swallow the change that caused it.
  savedMetaSignature = createMetaSignature();
  useEditorStore.getState().setSaveStatus('saved');
  // A document without a card picture (created from data, or before
  // thumbnails existed) gets one as soon as its 2D canvas is on screen. The
  // request outlives a 3D→2D remount and is cleared once a picture is stored.
  if (initialThumbnailFor === diagramId) {
    const tryCapture = () => {
      if (activeDiagramId !== diagramId || useEditorStore.getState().viewMode !== '2d') return;
      unsubscribeViewMode?.();
      unsubscribeViewMode = undefined;
      const { nodes, edges } = useFlowStore.getState();
      scheduleThumbnail(diagramId, createCanvasSignature(nodes, edges));
    };
    unsubscribeViewMode = useEditorStore.subscribe((state, previous) => {
      if (state.viewMode !== previous.viewMode) tryCapture();
    });
    setTimeout(tryCapture, 1500);
  }
}

/** Called by the editor when the loaded document has no thumbnail yet. */
export function requestInitialThumbnail(diagramId: string) {
  initialThumbnailFor = diagramId;
}

export function stopDiagramPersistence(diagramId: string) {
  if (thumbnailTimer) clearTimeout(thumbnailTimer);
  thumbnailTimer = undefined;
  thumbnailSignature = null;
  unsubscribeViewMode?.();
  unsubscribeViewMode = undefined;
  if (initialThumbnailFor !== null && initialThumbnailFor !== diagramId) initialThumbnailFor = null;
  if (activeDiagramId !== diagramId) return;
  activeDiagramId = null;
  ++saveGeneration;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = undefined;
  const request = pendingSave;
  pendingSave = null;
  // Flush the captured old document, not whichever graph the next route loads.
  // Its completion must not change the new document's save indicators.
  if (request) void performSave(request);
}

export const getIsHydrating = () => isHydrating;
export const getCanvasPageId = () => canvasPageId;
export const getBaselineSignature = () => baselineCanvasSignature;
export const getSavedMetaSignature = () => savedMetaSignature;

export function createCanvasSignature(nodes: Node[], edges: Edge[]) {
  return JSON.stringify({ nodes, edges });
}

export function createMetaSignature() {
  const m = useEditorMeta.getState();
  const { pages } = useEditorDoc.getState();
  const views = pages.map((page) => [page.id, page.name, page.view3d]);
  return `${m.fileName}\u0000${m.status}\u0000${JSON.stringify(views)}`;
}

// JSON clone drops function refs (e.g. a duplicated node's onEdit) safely — Next
// nodes fall back to useReactFlow().updateNodeData when onEdit is absent.
function clone<T>(items: T[]): T[] {
  return JSON.parse(JSON.stringify(items)) as T[];
}

// ── Canvas ↔ store sync ──
export function persistCanvasToStore() {
  const fs = useFlowStore.getState();
  const doc = useEditorDoc.getState();
  doc.updateActiveGraph(fs.nodes, fs.edges);
  baselineCanvasSignature = createCanvasSignature(fs.nodes, fs.edges);
  if (canvasPageId) doc.clearCanvasDirtyPage(canvasPageId);
}

export function hydrateCanvasFromStore() {
  const doc = useEditorDoc.getState();
  const active = getActivePage(doc);
  const nextNodes = clone(active?.nodes ?? []);
  const nextEdges = clone(active?.edges ?? []);

  isHydrating = true;
  const fs = useFlowStore.getState();
  fs.setNodes(nextNodes);
  fs.setEdges(nextEdges);
  canvasPageId = active?.id ?? null;
  baselineCanvasSignature = createCanvasSignature(nextNodes, nextEdges);
  if (canvasPageId) doc.clearCanvasDirtyPage(canvasPageId);

  // Reset undo/redo each time we swap into a different page snapshot.
  resetHistory(graphHistorySnapshot(nextNodes, nextEdges));

  queueMicrotask(() => {
    isHydrating = false;
  });
}

// ── Page handlers (persist old → mutate → hydrate new) ──
// Operations that change the document and re-hydrate the canvas are invisible
// to <DiagramPersistence/>'s effects (they skip hydration), so they schedule
// their own save. Switching pages changes nothing that is saved.
function autosaveDocumentChange() {
  if (activeDiagramId) scheduleAutosave(activeDiagramId, createMetaSignature());
}

export function handleSwitchPage(pageId: string) {
  if (isGraphGestureActive()) return;
  persistCanvasToStore();
  useEditorDoc.getState().switchPage(pageId);
  hydrateCanvasFromStore();
}

export function handleCreatePage() {
  if (!canMutateDocument()) return;
  persistCanvasToStore();
  useEditorDoc.getState().createPage();
  hydrateCanvasFromStore();
  autosaveDocumentChange();
}

export function handleDeletePage(pageId: string) {
  if (!canMutateDocument()) return;
  const isActive = useEditorDoc.getState().activePageId === pageId;
  useEditorDoc.getState().deletePage(pageId);
  if (isActive) hydrateCanvasFromStore();
  saveFullStateToStorage();
  autosaveDocumentChange();
}

export function handleDuplicatePage(pageId: string) {
  if (!canMutateDocument()) return;
  persistCanvasToStore();
  useEditorDoc.getState().duplicatePage(pageId);
  hydrateCanvasFromStore();
  saveFullStateToStorage();
  autosaveDocumentChange();
}

export function handleDeleteAllPages() {
  if (!canMutateDocument()) return;
  useEditorDoc.getState().deleteAllPages();
  hydrateCanvasFromStore();
  saveFullStateToStorage();
  autosaveDocumentChange();
}

export function handleRenamePage(pageId: string, name: string) {
  if (!canMutateDocument()) return;
  useEditorDoc.getState().renamePage(pageId, name);
}

// ── Cloud save (PATCH /diagrams/:id) ──
function captureSave(diagramId: string, generation: number, metaSignature: string): SaveRequest {
  const { nodes, edges } = useFlowStore.getState();
  const data = JSON.parse(exportEditorStateAsJSON()) as EditorState;
  // Capture live edits without resetting their dirty baseline. Serialization
  // happens now: a queued save can never read the next diagram's global stores.
  data.pages = data.pages.map((page) => page.id === canvasPageId ? { ...page, nodes, edges } : page);
  const meta = useEditorMeta.getState();
  return {
    diagramId,
    generation,
    metaSignature,
    canvasSignature: createCanvasSignature(nodes, edges),
    pageId: canvasPageId,
    pageSignatures: Object.fromEntries(data.pages.map((page) => [page.id, getPageSignature(page)])),
    body: JSON.stringify({ data, title: meta.fileName, status: meta.status }),
  };
}

function isCurrentSave(request: SaveRequest): boolean {
  if (activeDiagramId !== request.diagramId || saveGeneration !== request.generation) return false;
  // A page switch is not a different document. Compare the saved page with its
  // synchronized graph rather than leaving the new page stuck on "Saving…".
  const graph = canvasPageId === request.pageId
    ? useFlowStore.getState()
    : useEditorDoc.getState().pages.find((page) => page.id === request.pageId);
  return !!graph && createCanvasSignature(graph.nodes, graph.edges) === request.canvasSignature &&
    createMetaSignature() === request.metaSignature;
}

function performSave(request: SaveRequest) {
  // An earlier PATCH may still be in flight. UI generation checks alone do not
  // prevent it from overwriting a newer backend snapshot; order writes per id.
  return saveQueue.enqueue(request.diagramId, () => executeSave(request));
}

async function executeSave(request: SaveRequest) {
  try {
    if (isCurrentSave(request)) {
      if (canvasPageId === request.pageId) persistCanvasToStore();
      // Local cache failure (private mode/quota) must not prevent cloud save.
      if (request.pageId) savePageToStorage(request.pageId);
    }
    const response = await fetch(`${API_URL}/diagrams/${request.diagramId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-type': 'application/json' },
      body: request.body,
    });
    if (!response.ok) throw new Error(`Save failed with status ${response.status}`);

    // A newer edit/save may have started while this request was in flight — only
    // the newest request marks the document as saved.
    if (isCurrentSave(request)) {
      useEditorDoc.setState((state) => {
        const savedPageSignatures = { ...state.savedPageSignatures };
        for (const page of state.pages) {
          const signature = request.pageSignatures[page.id];
          if (signature === getPageSignature(page)) savedPageSignatures[page.id] = signature;
        }
        return { savedPageSignatures };
      });
      savedMetaSignature = request.metaSignature;
      useEditorMeta.getState().setLastSaved(Date.now());
      useEditorStore.getState().setSaveStatus('saved');
      scheduleThumbnail(request.diagramId, request.canvasSignature);
    }
  } catch (e) {
    console.error('Save failed', e);
    if (isCurrentSave(request)) useEditorStore.getState().setSaveStatus('error');
  }
}

export function scheduleAutosave(diagramId: string, metaSignature: string) {
  if (activeDiagramId !== diagramId) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  const generation = ++saveGeneration;
  const request = captureSave(diagramId, generation, metaSignature);
  pendingSave = request;
  useEditorStore.getState().setSaveStatus('saving');
  autosaveTimer = setTimeout(() => {
    autosaveTimer = undefined;
    pendingSave = null;
    void performSave(request);
  }, 1000);
}

export async function handleSave(diagramId: string) {
  if (activeDiagramId !== diagramId) return;
  // A manual save supersedes a pending debounced autosave.
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = undefined;
  pendingSave = null;
  const generation = ++saveGeneration;
  useEditorStore.getState().setSaveStatus('saving');
  await performSave(captureSave(diagramId, generation, createMetaSignature()));
}

// ── Dashboard thumbnail ──
// A small picture of the 2D canvas follows each save, a little later so a
// burst of autosaves renders once. Only the 2D view is captured: the
// dashboard shows the plan, and the 3D canvas is WebGL.
let thumbnailTimer: ReturnType<typeof setTimeout> | undefined;
let thumbnailSignature: string | null = null;
let initialThumbnailFor: string | null = null;
let unsubscribeViewMode: (() => void) | undefined;

function scheduleThumbnail(diagramId: string, signature: string) {
  if (signature === thumbnailSignature) return;
  if (thumbnailTimer) clearTimeout(thumbnailTimer);
  thumbnailTimer = setTimeout(() => {
    thumbnailTimer = undefined;
    void refreshThumbnail(diagramId, signature);
  }, 2500);
}

async function refreshThumbnail(diagramId: string, signature: string) {
  if (activeDiagramId !== diagramId || signature === thumbnailSignature) return;
  if (typeof document === 'undefined' || document.hidden) return;
  if (useEditorStore.getState().viewMode !== '2d') return;
  const root = document.querySelector('.react-flow') as HTMLElement | null;
  const bounds = getFullDiagramBounds();
  if (!root || !bounds) return;
  try {
    const canvas = await captureThumbnailCanvas(root, bounds, THUMBNAIL_MAX_WIDTH, THUMBNAIL_MAX_HEIGHT);
    if (activeDiagramId !== diagramId) return;
    if (await uploadThumbnail(diagramId, encodeThumbnail(canvas))) {
      thumbnailSignature = signature;
      if (initialThumbnailFor === diagramId) initialThumbnailFor = null;
    }
  } catch {
    // A preview is a nicety; never surface it as a save error.
  }
}

// ── File > New / Open ──
export function handleNewFile() {
  if (!canMutateDocument()) return;
  const unsaved = computeVisibleUnsavedPageIds(useEditorDoc.getState());
  if (unsaved.length > 0) {
    const ok = window.confirm('You have unsaved changes. Discard them and start a new file?');
    if (!ok) return;
  }
  useEditorDoc.getState().resetEditorState();
  useEditorStore.getState().setViewMode('2d');
  hydrateCanvasFromStore();
}

export function loadFileContent(content: string): boolean {
  if (!canMutateDocument()) return false;
  const ok = useEditorDoc.getState().loadEditorStateFromJSON(content);
  if (ok) {
    // Imported files may reuse a page id. Remount spatial state on next entry
    // instead of retaining the previous file's frozen origin/camera refs.
    useEditorStore.getState().setViewMode('2d');
    hydrateCanvasFromStore();
    autosaveDocumentChange();
  }
  return ok;
}

/**
 * File › Open / Import: loads a file picked from disk into this diagram. An
 * EasyDraw file goes straight in; anything else is converted by
 * `@easydraw/diagram-import`, and the outcome — what landed, what could
 * not — is published for the import notice. Replacing a non-empty diagram
 * asks first, since the result overwrites what is on the canvas.
 */
export async function openFileFromDisk(file: File): Promise<void> {
  if (!canMutateDocument()) return;
  const report = useImportReport.getState();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectFormat(bytes);

  if (format === 'easydraw' || format === 'unknown') {
    // EasyDraw's own JSON / .easydraw, or something we cannot name: let the
    // native loader decide, and only then say it is not an EasyDraw file.
    const text = new TextDecoder().decode(bytes);
    if (format === 'easydraw' && !confirmReplace()) return;
    if (loadFileContent(text)) {
      report.dismiss();
      return;
    }
    if (format === 'easydraw') {
      report.show({ ok: false, fileName: file.name, error: 'The file is not a valid EasyDraw diagram.' });
      return;
    }
  }

  const result = importDiagram(bytes, file.name);
  if (!result.ok) {
    report.show({ ok: false, fileName: file.name, error: result.error });
    return;
  }
  if (!confirmReplace()) return;
  if (!loadFileContent(JSON.stringify(result.document))) {
    report.show({ ok: false, fileName: file.name, error: 'The converted diagram could not be loaded.' });
    return;
  }
  report.show({
    ok: true,
    fileName: file.name,
    formatLabel: IMPORT_FORMAT_LABELS[result.format],
    stats: result.stats,
    warnings: result.warnings,
  });
}

function confirmReplace(): boolean {
  const hasContent = useEditorDoc.getState().pages.some((page) => page.nodes.length > 0 || page.edges.length > 0);
  if (!hasContent) return true;
  return window.confirm('Opening a file replaces everything in this diagram. Continue?');
}

// ── Export ──
function getFullDiagramBounds(): ExportBounds | null {
  const { nodes, edges } = useFlowStore.getState();
  if (nodes.length === 0) return null;

  const b = getNodesBounds(nodes);
  let minX = b.x;
  let minY = b.y;
  let maxX = b.x + b.width;
  let maxY = b.y + b.height;

  // Manually-routed connections may bend outside every node — include their
  // control points so long detours are not clipped from the export.
  for (const edge of edges) {
    const bendPoints = (edge.data as { bendPoints?: { x: number; y: number }[] } | undefined)
      ?.bendPoints;
    for (const point of bendPoints ?? []) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function getExportContext(): ExportContext {
  persistCanvasToStore();
  const meta = useEditorMeta.getState();
  return {
    fileName: meta.fileName || 'easydraw',
    serializedState: exportEditorStateAsJSON(),
    canvasElement:
      typeof document !== 'undefined'
        ? (document.querySelector('.react-flow') as HTMLElement | null)
        : null,
    diagramBounds: getFullDiagramBounds(),
  };
}

// Save As = download a copy as a native .easydraw file (draw.io semantics).
export async function handleSaveAs() {
  const easydraw = getExporter('easydraw');
  if (!easydraw) return;
  await easydraw.run(getExportContext());
}

export async function handleExport(formatId: string) {
  const exporter = getExporter(formatId);
  if (!exporter) {
    window.alert(`Unknown export format: ${formatId}`);
    return;
  }
  try {
    if (useEditorStore.getState().viewMode === '3d' && ['png', 'jpeg', 'pdf'].includes(formatId)) {
      const { exportScene3D } = await import('@/lib/diagram3d/export-scene');
      await exportScene3D(formatId, useEditorMeta.getState().fileName || 'Untitled');
    } else await exporter.run(getExportContext());
  } catch (err) {
    console.error(`Export to ${exporter.label} failed:`, err);
    window.alert(`Export to ${exporter.label} failed: ${err instanceof Error ? err.message : 'Please try again.'}`);
  }
}

// ── Undo/redo snapshot application (called by the editor context) ──
export function applyHistorySnapshot(snapshot: string) {
  try {
    const parsed = JSON.parse(snapshot) as { nodes: Node[]; edges: Edge[] };
    setApplyingHistory(true);
    isHydrating = true;
    const fs = useFlowStore.getState();
    const selectedNodes = new Set(fs.nodes.filter((node) => node.selected).map((node) => node.id));
    const selectedEdges = new Set(fs.edges.filter((edge) => edge.selected).map((edge) => edge.id));
    fs.setNodes(clone(parsed.nodes).map((node) => ({ ...node, selected: selectedNodes.has(node.id) })));
    fs.setEdges(clone(parsed.edges).map((edge) => ({ ...edge, selected: selectedEdges.has(edge.id) })));
    queueMicrotask(() => {
      setApplyingHistory(false);
      isHydrating = false;
    });
  } catch {
    // Ignore corrupt snapshot.
  }
}
