import { loadImageElement } from './engine/engine';
import { LINE_WIDTHS, type ToolId } from './engine/types';
import { TOOLS } from './ToolSidebar';
import { useWhiteboard } from './whiteboard.store';

/**
 * Editor-level commands shared by the menus, the toolbar and the keyboard:
 * one implementation each, so a shortcut and a menu item can never drift.
 */
export interface WhiteboardActions {
  undo(): void;
  redo(): void;
  cut(): void;
  copy(): void;
  paste(): void;
  pasteFromFile(): void;
  duplicate(): void;
  deleteSelection(): void;
  selectAll(): void;
  invert(): void;
  crop(): void;
  rotate(direction: 'cw' | 'ccw'): void;
  flip(axis: 'horizontal' | 'vertical'): void;
  resize(): void;
  clear(): void;
  openImage(): void;
  download(format: 'png' | 'jpeg'): void;
  print(): void;
  zoomIn(): void;
  zoomOut(): void;
  zoomReset(): void;
  toggleGrid(): void;
  shortcuts(): void;
}

function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

async function imageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImageElement(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  a.click();
}

function safeFileName(title: string): string {
  return (title.trim() || 'whiteboard').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
}

export function createActions(): WhiteboardActions {
  const store = useWhiteboard.getState;
  const engine = () => store().engine;
  const pasteAt = () => store().viewOrigin;

  return {
    undo: () => engine()?.undo(),
    redo: () => engine()?.redo(),
    cut: () => engine()?.cut(),
    copy: () => engine()?.copy(),
    paste: () => {
      const e = engine();
      if (!e) return;
      // Prefer what the system clipboard holds; fall back to the last copy here.
      void (async () => {
        try {
          if (navigator.clipboard?.read) {
            for (const item of await navigator.clipboard.read()) {
              const type = item.types.find((t) => t.startsWith('image/'));
              if (!type) continue;
              const blob = await item.getType(type);
              e.paste(await imageFromFile(new File([blob], 'clipboard', { type })), pasteAt());
              return;
            }
          }
        } catch {
          // Permission denied or nothing readable: use the internal clipboard.
        }
        e.pasteFromClipboard(pasteAt());
      })();
    },
    pasteFromFile: () => {
      void (async () => {
        const file = await pickImageFile();
        const e = engine();
        if (!file || !e) return;
        e.paste(await imageFromFile(file), pasteAt());
      })();
    },
    duplicate: () => engine()?.duplicate(),
    deleteSelection: () => engine()?.deleteSelection(),
    selectAll: () => engine()?.selectAll(),
    invert: () => engine()?.invert(),
    crop: () => engine()?.crop(),
    rotate: (direction) => engine()?.rotate(direction),
    flip: (axis) => engine()?.flip(axis),
    resize: () => store().openDialog('resize'),
    clear: () => store().openDialog('clear'),
    openImage: () => {
      void (async () => {
        const file = await pickImageFile();
        const e = engine();
        if (!file || !e) return;
        e.openImage(await imageFromFile(file));
      })();
    },
    download: (format) => {
      const e = engine();
      if (!e) return;
      e.commitSelection();
      const name = safeFileName(store().title);
      if (format === 'png') {
        downloadDataUrl(e.doc.toDataURL('image/png'), `${name}.png`);
        return;
      }
      // JPEG has no alpha; flatten on white first.
      const flat = document.createElement('canvas');
      flat.width = e.width;
      flat.height = e.height;
      const ctx = flat.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, flat.width, flat.height);
      ctx.drawImage(e.doc, 0, 0);
      downloadDataUrl(flat.toDataURL('image/jpeg', 0.92), `${name}.jpg`);
    },
    print: () => {
      const e = engine();
      if (!e) return;
      e.commitSelection();
      const win = window.open('', '_blank', 'noopener');
      if (!win) return;
      win.document.write(
        `<!doctype html><title>${safeFileName(store().title)}</title><style>body{margin:0;display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100vh}</style><img src="${e.doc.toDataURL('image/png')}" onload="window.print()">`,
      );
      win.document.close();
    },
    zoomIn: () => store().zoomIn(),
    zoomOut: () => store().zoomOut(),
    zoomReset: () => store().setZoom(1),
    toggleGrid: () => store().toggleGrid(),
    shortcuts: () => store().openDialog('shortcuts'),
  };
}

const TOOL_KEYS = new Map<string, ToolId>(TOOLS.filter((t) => t.key).map((t) => [t.key!.toLowerCase(), t.id]));

/**
 * Keyboard shortcuts, PaintZ's set. Returns true when the key was handled so
 * the caller can stop the browser's own binding (Ctrl+S, Ctrl+P, …).
 */
export function handleShortcut(e: KeyboardEvent, actions: WhiteboardActions): boolean {
  const engine = useWhiteboard.getState().engine;
  if (!engine) return false;
  const ctrl = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (ctrl && e.altKey) {
    if (key === '=' || key === '+') return run(actions.zoomIn);
    if (key === '-') return run(actions.zoomOut);
    if (key === '0') return run(actions.zoomReset);
    if (key === 'v') return run(actions.pasteFromFile);
    return false;
  }
  if (ctrl) {
    switch (key) {
      case 'z':
        return run(e.shiftKey ? actions.redo : actions.undo);
      case 'y':
        return run(actions.redo);
      case 'a':
        return run(actions.selectAll);
      case 'c':
        return run(actions.copy);
      case 'x':
        return run(actions.cut);
      case 'd':
        return run(actions.duplicate);
      case 'i':
        return run(actions.invert);
      case 'e':
        return run(actions.resize);
      case 's':
        return run(() => actions.download('png'));
      case 'o':
        return run(actions.openImage);
      case 'p':
        return run(actions.print);
      case 'g':
        return run(actions.toggleGrid);
      case 'n':
        return run(actions.clear);
      default:
        return false;
    }
  }
  if (e.altKey) return false;
  switch (e.key) {
    case 'Escape':
      return run(() => engine.cancel());
    case 'Enter':
      return run(() => engine.finish());
    case 'Delete':
    case 'Backspace':
      return run(actions.deleteSelection);
    case '[':
    case ']': {
      const index = LINE_WIDTHS.indexOf(engine.options.lineWidth as (typeof LINE_WIDTHS)[number]);
      const next = LINE_WIDTHS[Math.max(0, Math.min(LINE_WIDTHS.length - 1, (index === -1 ? 0 : index) + (e.key === ']' ? 1 : -1)))]!;
      return run(() => engine.setOptions({ lineWidth: next }));
    }
    case '?':
      return run(actions.shortcuts);
    default:
      break;
  }
  if (key === 'x') return run(() => engine.swapColors());
  const tool = TOOL_KEYS.get(key);
  if (tool) return run(() => engine.setTool(tool));
  return false;
}

function run(fn: () => void): boolean {
  fn();
  return true;
}
