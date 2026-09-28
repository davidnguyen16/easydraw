'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { MAX_WHITEBOARD_SIZE, MIN_WHITEBOARD_SIZE } from '@easydraw/pack-whiteboard';
import type { ResizeMode } from './engine/engine';
import { useWhiteboard } from './whiteboard.store';

function Dialog({ title, onClose, children, width = 'max-w-md' }: { title: string; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div className={`relative z-10 w-full ${width} rounded-2xl border border-line bg-white p-6 shadow-xl`}>
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mt-1 -mr-1 rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const PRIMARY = 'inline-flex min-h-10 items-center rounded-lg bg-mq-red px-4 text-sm font-semibold text-white transition-colors hover:bg-mq-red-hover disabled:opacity-50';
const SECONDARY = 'inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-hover';
const FIELD = 'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-mq-red';

/** Routes the store's `dialog` to the right modal. */
export default function WhiteboardDialogs() {
  const dialog = useWhiteboard((s) => s.dialog);
  const openDialog = useWhiteboard((s) => s.openDialog);
  const close = () => openDialog(null);
  if (dialog === 'resize') return <ResizeDialog onClose={close} />;
  if (dialog === 'clear') return <ClearDialog onClose={close} />;
  if (dialog === 'shortcuts') return <ShortcutsDialog onClose={close} />;
  return null;
}

/** PaintZ's "Crop or scale": new size in px or %, aspect lock, crop vs scale. */
function ResizeDialog({ onClose }: { onClose: () => void }) {
  const engine = useWhiteboard((s) => s.engine);
  const size = useWhiteboard((s) => s.size);
  const [unit, setUnit] = useState<'px' | '%'>('px');
  const [width, setWidth] = useState(String(size.width));
  const [height, setHeight] = useState(String(size.height));
  const [keepAspect, setKeepAspect] = useState(true);
  const [mode, setMode] = useState<ResizeMode>('scale');
  const aspect = size.width / size.height;

  const toPx = (value: string, base: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return NaN;
    return Math.round(unit === '%' ? (base * n) / 100 : n);
  };
  const targetWidth = toPx(width, size.width);
  const targetHeight = toPx(height, size.height);
  const valid = [targetWidth, targetHeight].every((v) => Number.isInteger(v) && v >= MIN_WHITEBOARD_SIZE && v <= MAX_WHITEBOARD_SIZE);

  const onWidth = (value: string) => {
    setWidth(value);
    if (keepAspect) {
      const n = Number(value);
      if (Number.isFinite(n)) setHeight(unit === '%' ? value : String(Math.round(n / aspect)));
    }
  };
  const onHeight = (value: string) => {
    setHeight(value);
    if (keepAspect) {
      const n = Number(value);
      if (Number.isFinite(n)) setWidth(unit === '%' ? value : String(Math.round(n * aspect)));
    }
  };
  const switchUnit = (next: 'px' | '%') => {
    if (next === unit) return;
    setUnit(next);
    if (next === '%') {
      setWidth('100');
      setHeight('100');
    } else {
      setWidth(String(size.width));
      setHeight(String(size.height));
    }
  };

  return (
    <Dialog title="Crop or scale" onClose={onClose}>
      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
        <input className={FIELD} type="number" min={1} aria-label="Width" value={width} onChange={(e) => onWidth(e.target.value)} />
        <span className="text-ink-muted">×</span>
        <input className={FIELD} type="number" min={1} aria-label="Height" value={height} onChange={(e) => onHeight(e.target.value)} />
        <select className={`${FIELD} w-auto`} aria-label="Unit" value={unit} onChange={(e) => switchUnit(e.target.value as 'px' | '%')}>
          <option value="px">px</option>
          <option value="%">%</option>
        </select>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {valid ? `Result: ${targetWidth} × ${targetHeight} px` : `Sizes must be whole numbers between ${MIN_WHITEBOARD_SIZE} and ${MAX_WHITEBOARD_SIZE} px.`}
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" className="accent-mq-red" checked={keepAspect} onChange={(e) => setKeepAspect(e.target.checked)} />
        Maintain aspect ratio
      </label>
      <div className="mt-4 flex gap-6 text-sm text-ink" role="radiogroup" aria-label="Method">
        <label className="flex items-center gap-2">
          <input type="radio" className="accent-mq-red" name="resize-mode" checked={mode === 'crop'} onChange={() => setMode('crop')} />
          Crop
          <span className="text-ink-muted">— keep pixels, change the edges</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" className="accent-mq-red" name="resize-mode" checked={mode === 'scale'} onChange={() => setMode('scale')} />
          Scale
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className={SECONDARY} onClick={onClose}>Cancel</button>
        <button
          type="button"
          className={PRIMARY}
          disabled={!valid}
          onClick={() => {
            engine?.resize(targetWidth, targetHeight, mode);
            onClose();
          }}
        >
          Resize
        </button>
      </div>
    </Dialog>
  );
}

function ClearDialog({ onClose }: { onClose: () => void }) {
  const engine = useWhiteboard((s) => s.engine);
  return (
    <Dialog title="Clear entire drawing?" onClose={onClose}>
      <p className="text-sm text-ink-muted">Everything on the board is replaced with white. You can undo this.</p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className={SECONDARY} onClick={onClose}>Cancel</button>
        <button
          type="button"
          className={PRIMARY}
          onClick={() => {
            engine?.clear();
            onClose();
          }}
        >
          Clear
        </button>
      </div>
    </Dialog>
  );
}

const SHORTCUTS: { group: string; keys: [string, string][] }[] = [
  {
    group: 'Document',
    keys: [
      ['Ctrl + N', 'Clear drawing'], ['Ctrl + O', 'Open image'], ['Ctrl + S', 'Save as PNG'], ['Ctrl + P', 'Print'],
      ['Ctrl + Z', 'Undo'], ['Ctrl + Y', 'Redo'], ['Ctrl + E', 'Crop or scale'], ['Ctrl + V', 'Paste'],
      ['Ctrl + Alt + V', 'Paste from file'], ['Ctrl + Alt + =', 'Zoom in'], ['Ctrl + Alt + -', 'Zoom out'],
      ['Ctrl + Alt + 0', 'Zoom 100%'], ['Ctrl + G', 'Show / hide gridlines'],
    ],
  },
  {
    group: 'Tools',
    keys: [
      ['P', 'Pencil'], ['B', 'Brush'], ['L', 'Line'], ['C', 'Curve'], ['R', 'Rectangle'], ['O', 'Oval'],
      ['H', 'Pan'], ['S', 'Selection'], ['F', 'Freeform selection'], ['E', 'Eraser'], ['K', 'Flood fill'],
      ['I', 'Color picker'], ['T', 'Text'],
    ],
  },
  {
    group: 'Drawing',
    keys: [['[', 'Decrease line width'], [']', 'Increase line width'], ['X', 'Switch line and fill colours'], ['Shift + drag', 'Square, circle or 45° line'], ['Right button', 'Draw with the fill colour']],
  },
  {
    group: 'Selection',
    keys: [
      ['Ctrl + A', 'Select all'], ['Esc', 'Finish selection, text box or polygon'], ['Enter', 'Close polygon / finish curve'],
      ['Delete', 'Delete selection'], ['Ctrl + D', 'Duplicate selection'], ['Ctrl + X', 'Cut'], ['Ctrl + C', 'Copy'], ['Ctrl + I', 'Invert colors'],
    ],
  },
  { group: 'Text', keys: [['Ctrl + Enter', 'Finalize text'], ['Esc', 'Discard text box']] },
];

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} width="max-w-3xl">
      <div className="grid max-h-[70vh] grid-cols-1 gap-6 overflow-auto sm:grid-cols-2">
        {SHORTCUTS.map((section) => (
          <section key={section.group}>
            <h3 className="mb-2 text-[0.72rem] font-bold tracking-[0.12em] text-mq-maroon uppercase">{section.group}</h3>
            <dl className="space-y-1">
              {section.keys.map(([keys, what]) => (
                <div key={keys + what} className="flex items-baseline justify-between gap-4 text-sm">
                  <dt className="font-mono text-[0.8rem] text-ink">{keys}</dt>
                  <dd className="text-right text-ink-muted">{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
