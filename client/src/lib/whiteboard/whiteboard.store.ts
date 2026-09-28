import { create } from 'zustand';
import { API_URL } from '@/lib/api';
import { encodeThumbnail, shrinkCanvas, uploadThumbnail } from '@/lib/thumbnails';
import type { WhiteboardEngine } from './engine/engine';
import { DEFAULT_DRAW_OPTIONS, ZOOM_LEVELS, type DrawOptions, type ToolId } from './engine/types';
import { KeyedSaveQueue } from '@/lib/flow/save-queue';

/**
 * React-facing view of the whiteboard editor. The engine owns the pixels and
 * the tool state machines; this store mirrors what the chrome displays
 * (`sync` copies the engine's fields after every `notify`) and owns the
 * purely UI-side state: zoom, grid, pointer readout, dialogs, autosave.
 */
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
export type WhiteboardDialog = 'resize' | 'clear' | 'shortcuts' | null;

interface WhiteboardState {
  engine: WhiteboardEngine | null;
  diagramId: string | null;
  title: string;
  tool: ToolId;
  options: DrawOptions;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  hasClipboard: boolean;
  textEditing: boolean;
  contentRevision: number;
  previewBlockedReason: string | null;
  size: { width: number; height: number };
  zoom: number;
  showGrid: boolean;
  pointer: { x: number; y: number } | null;
  /** Image coordinates of the viewport's visible top-left; where pastes land. */
  viewOrigin: { x: number; y: number };
  dialog: WhiteboardDialog;
  saveState: SaveState;
  saveError: string | null;

  attach(engine: WhiteboardEngine, diagramId: string, title: string): void;
  /** Capture pending pixels before releasing the engine, then drain this session. */
  detach(): Promise<boolean>;
  /** Copy the engine's displayable state; called from the engine's notify. */
  sync(): void;
  setTitle(title: string): void;
  setZoom(zoom: number): void;
  zoomIn(): void;
  zoomOut(): void;
  toggleGrid(): void;
  setPointer(p: { x: number; y: number } | null): void;
  setViewOrigin(p: { x: number; y: number }): void;
  openDialog(dialog: WhiteboardDialog): void;
  /** The board changed; save after a short pause. */
  markDirty(): void;
  /** Wait for all saves in this document session; false preserves the editor on failure. */
  flush(): Promise<boolean>;
}

const SAVE_DEBOUNCE_MS = 1500;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
interface SaveSession {
  engine: WhiteboardEngine;
  diagramId: string;
  pendingTitle: string | null;
  pendingBoard: boolean;
  snapshot: Record<string, unknown>;
  saving: Promise<boolean> | null;
}
let session: SaveSession | null = null;
const saveQueue = new KeyedSaveQueue();

export const useWhiteboard = create<WhiteboardState>((set, get) => ({
  engine: null,
  diagramId: null,
  title: '',
  tool: 'pencil',
  options: DEFAULT_DRAW_OPTIONS,
  canUndo: false,
  canRedo: false,
  hasSelection: false,
  hasClipboard: false,
  textEditing: false,
  contentRevision: 0,
  previewBlockedReason: null,
  size: { width: 0, height: 0 },
  zoom: 1,
  showGrid: false,
  pointer: null,
  viewOrigin: { x: 0, y: 0 },
  dialog: null,
  saveState: 'saved',
  saveError: null,

  attach(engine, diagramId, title) {
    if (session) void get().detach();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = undefined;
    session = { engine, diagramId, pendingTitle: null, pendingBoard: false, snapshot: {}, saving: null };
    set({ engine, diagramId, title, zoom: 1, pointer: null, dialog: null, saveState: 'saved', saveError: null });
    get().sync();
  },

  detach() {
    const oldSession = session;
    // save() captures the latest pixels synchronously, before awaiting an older
    // PATCH. A route change must not discard B while A is still in flight.
    const drained = oldSession ? save(oldSession, set) : Promise.resolve(true);
    session = null;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = undefined;
    set({ engine: null, diagramId: null, contentRevision: 0, previewBlockedReason: null });
    return drained;
  },

  sync() {
    const engine = get().engine;
    if (!engine) return;
    set({
      tool: engine.tool,
      options: engine.options,
      canUndo: engine.canUndo,
      canRedo: engine.canRedo,
      hasSelection: engine.selection !== null,
      hasClipboard: engine.clipboard !== null,
      textEditing: engine.textBox !== null,
      contentRevision: engine.contentRevision,
      previewBlockedReason: engine.previewBlockedReason,
      size: { width: engine.width, height: engine.height },
    });
  },

  setTitle(title) {
    if (!session) return;
    set({ title });
    session.pendingTitle = title;
    scheduleSave(get, set);
  },

  setZoom(zoom) {
    set({ zoom: Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]!, Math.max(ZOOM_LEVELS[0]!, zoom)) });
  },
  zoomIn() {
    const next = ZOOM_LEVELS.find((level) => level > get().zoom + 1e-6);
    if (next) set({ zoom: next });
  },
  zoomOut() {
    const next = [...ZOOM_LEVELS].reverse().find((level) => level < get().zoom - 1e-6);
    if (next) set({ zoom: next });
  },
  toggleGrid() {
    set((s) => ({ showGrid: !s.showGrid }));
  },
  setPointer(pointer) {
    const current = get().pointer;
    if (current?.x === pointer?.x && current?.y === pointer?.y) return;
    set({ pointer });
  },
  setViewOrigin(viewOrigin) {
    const current = get().viewOrigin;
    if (current.x === viewOrigin.x && current.y === viewOrigin.y) return;
    set({ viewOrigin });
  },
  openDialog(dialog) {
    set({ dialog });
  },

  markDirty() {
    if (!session) return;
    session.pendingBoard = true;
    scheduleSave(get, set);
  },

  async flush() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = undefined;
    const started = session;
    return started ? await save(started, set) && session === started : false;
  },
}));

type Get = () => WhiteboardState;
type Set = (partial: Partial<WhiteboardState>) => void;

function scheduleSave(get: Get, set: Set): void {
  set({ saveState: 'dirty' });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void get().flush();
  }, SAVE_DEBOUNCE_MS);
}

async function save(started: SaveSession, set: Set): Promise<boolean> {
  const { engine, diagramId } = started;
  const current = () => session === started;
  // Freeze changes now. Detached sessions never consult a new route's engine.
  try {
    if (started.pendingTitle !== null) started.snapshot.title = started.pendingTitle.trim() || 'Untitled Whiteboard';
    if (started.pendingBoard) started.snapshot.data = engine.toDocument();
    started.pendingTitle = null;
    started.pendingBoard = false;
  } catch (error) {
    if (current()) set({ saveState: 'error', saveError: error instanceof Error ? error.message : 'Could not encode the whiteboard.' });
    return false;
  }
  // A flush joins an existing request, then drains newer edits in order. An
  // older PATCH must never overwrite a newer one or report another board saved.
  if (started.saving) {
    if (!await started.saving) return false;
    return save(started, set);
  }
  if (Object.keys(started.snapshot).length === 0) {
    if (current()) set({ saveState: 'saved', saveError: null });
    return true;
  }
  const body = started.snapshot;
  started.snapshot = {};
  if (current()) set({ saveState: 'saving', saveError: null });
  const request = saveQueue.enqueue(diagramId, async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch(`${API_URL}/diagrams/${diagramId}`, {
          method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
        // Thumbnail failures must not turn a confirmed document save into an error.
        if (body.data && current() && !started.pendingBoard) {
          try { void uploadThumbnail(diagramId, encodeThumbnail(shrinkCanvas(engine.doc))); } catch { /* Best effort only. */ }
        }
        return true;
      } catch (error) {
        // Keep the failed snapshot, but never replace more recent captured
        // changes. A manual retry serializes any still newer live pixels.
        started.snapshot = { ...body, ...started.snapshot };
        if (current()) {
          set({ saveState: 'error', saveError: error instanceof Error ? error.message : 'Save failed' });
        }
        return false;
      } finally {
        clearTimeout(timeout);
      }
  });
  started.saving = request;
  const success = await request;
  if (started.saving === request) started.saving = null;
  if (!success) return false;
  return save(started, set);
}

/** Browser refresh/close cannot await an async PATCH (PNG may exceed keepalive limits). */
export function warnBeforeWhiteboardUnload(event: BeforeUnloadEvent): void {
  if (useWhiteboard.getState().engine && useWhiteboard.getState().saveState !== 'saved') {
    event.preventDefault();
    event.returnValue = '';
  }
}
