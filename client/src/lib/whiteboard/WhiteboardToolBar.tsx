'use client';

import {
  Bold,
  Contrast,
  FlipHorizontal2,
  FlipVertical2,
  Italic,
  Palette,
  Redo2,
  RotateCcw,
  RotateCw,
  SquareDashed,
  Strikethrough,
  Underline,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { FONT_SIZES, LINE_WIDTHS, ZOOM_LEVELS, type OutlineMode } from './engine/types';
import { useWhiteboard } from './whiteboard.store';

const ICON_BTN =
  'tb-tip relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent p-0 ' +
  'text-toolbar-text transition-colors duration-[120ms] [&_svg]:size-[18px] enabled:hover:bg-surface-hover enabled:hover:text-[#1f201d] ' +
  'disabled:cursor-not-allowed disabled:opacity-35';
const TOGGLE_BTN = `${ICON_BTN} aria-pressed:bg-mq-pink aria-pressed:text-mq-red`;
const SELECT =
  'h-8 cursor-pointer rounded-md border border-line bg-white px-2 text-[0.82rem] text-ink-soft outline-none focus:border-mq-red';

const FONT_FAMILIES = ['Inter, system-ui, sans-serif', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Comic Sans MS'];

const OUTLINE_MODES: { id: OutlineMode; label: string }[] = [
  { id: 'outline', label: 'Outline only' },
  { id: 'fill', label: 'Fill only' },
  { id: 'both', label: 'Outline and fill' },
];

function Divider() {
  return <div className="mx-1.5 h-[22px] w-px bg-line-soft" />;
}

/** Outline / fill mode glyphs, drawn inline so they read at 18px. */
function OutlineGlyph({ mode }: { mode: OutlineMode }) {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <rect x="3" y="3" width="12" height="12" rx="2" fill={mode === 'outline' ? 'none' : 'currentColor'} fillOpacity={mode === 'both' ? 0.35 : 1} stroke={mode === 'fill' ? 'none' : 'currentColor'} strokeWidth="1.8" />
    </svg>
  );
}

/**
 * The row under the header: history, zoom, then the options of the active
 * tool (line width and outline mode for drawing tools, font controls for
 * text, transforms for selections) — the same shape as the diagram toolbar.
 */
export default function WhiteboardToolBar({ showColors, onToggleColors }: {
  showColors: boolean;
  onToggleColors: () => void;
}) {
  const engine = useWhiteboard((s) => s.engine);
  const tool = useWhiteboard((s) => s.tool);
  const options = useWhiteboard((s) => s.options);
  const canUndo = useWhiteboard((s) => s.canUndo);
  const canRedo = useWhiteboard((s) => s.canRedo);
  const zoom = useWhiteboard((s) => s.zoom);
  const setZoom = useWhiteboard((s) => s.setZoom);
  const zoomIn = useWhiteboard((s) => s.zoomIn);
  const zoomOut = useWhiteboard((s) => s.zoomOut);

  const drawing = !['selection', 'freeform-selection', 'pan', 'eyedropper', 'flood-fill', 'text'].includes(tool);
  const shapes = ['rectangle', 'rounded-rectangle', 'oval', 'polygon'].includes(tool);
  const selecting = tool === 'selection' || tool === 'freeform-selection';
  const text = options.text;

  return (
    <div className="relative flex min-h-[46px] w-full items-center gap-1 border-b border-line-soft bg-white py-0 pl-3 pr-3 [font-family:system-ui,-apple-system,sans-serif]">
      <div className="flex items-center gap-0.5">
        <button type="button" className={ICON_BTN} aria-label="Undo (Ctrl+Z)" onClick={() => engine?.undo()} disabled={!canUndo}>
          <Undo2 />
        </button>
        <button type="button" className={ICON_BTN} aria-label="Redo (Ctrl+Y)" onClick={() => engine?.redo()} disabled={!canRedo}>
          <Redo2 />
        </button>
      </div>
      <Divider />
      <div className="flex items-center gap-0.5">
        <button type="button" className={ICON_BTN} aria-label="Zoom out (Ctrl+Alt+-)" onClick={zoomOut} disabled={zoom <= ZOOM_LEVELS[0]!}>
          <ZoomOut />
        </button>
        <select className={`${SELECT} w-[84px]`} aria-label="Zoom level" value={String(zoom)} onChange={(e) => setZoom(Number(e.target.value))}>
          {!(ZOOM_LEVELS as readonly number[]).includes(zoom) && <option value={String(zoom)}>{Math.round(zoom * 100)}%</option>}
          {ZOOM_LEVELS.map((level) => (
            <option key={level} value={String(level)}>
              {Math.round(level * 100)}%
            </option>
          ))}
        </select>
        <button type="button" className={ICON_BTN} aria-label="Zoom in (Ctrl+Alt+=)" onClick={zoomIn} disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]!}>
          <ZoomIn />
        </button>
      </div>

      <Divider />
      {/* Enter/Space belong to this button, not the canvas gesture shortcuts. */}
      <button
        type="button"
        aria-label="Colors"
        aria-pressed={showColors}
        aria-expanded={showColors}
        aria-controls="whiteboard-colors-panel"
        title={showColors ? 'Hide color panel' : 'Show color panel'}
        onClick={onToggleColors}
        onKeyDown={(event) => event.stopPropagation()}
        className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-line px-2 text-[0.82rem] text-toolbar-text transition-colors hover:bg-surface-hover aria-pressed:border-mq-red/30 aria-pressed:bg-mq-pink aria-pressed:text-mq-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mq-red"
      >
        <Palette size={17} aria-hidden="true" />
        Colors
      </button>

      {drawing && (
        <>
          <Divider />
          <label className="flex items-center gap-1.5 text-[0.78rem] text-ink-muted">
            Width
            <select className={`${SELECT} w-[64px]`} aria-label="Line width ([ / ])" value={options.lineWidth} onChange={(e) => engine?.setOptions({ lineWidth: Number(e.target.value) })}>
              {LINE_WIDTHS.map((w) => (
                <option key={w} value={w}>
                  {w}px
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {shapes && (
        <>
          <Divider />
          <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Shape style">
            {OUTLINE_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={options.outlineMode === mode.id}
                aria-label={mode.label}
                onClick={() => engine?.setOptions({ outlineMode: mode.id })}
                className={`${ICON_BTN} ${options.outlineMode === mode.id ? 'bg-mq-pink text-mq-red' : ''}`}
              >
                <OutlineGlyph mode={mode.id} />
              </button>
            ))}
          </div>
        </>
      )}

      {tool === 'text' && (
        <>
          <Divider />
          <select className={`${SELECT} w-[150px]`} aria-label="Font family" value={text.fontFamily} onChange={(e) => engine?.setOptions({ text: { fontFamily: e.target.value } })}>
            {FONT_FAMILIES.map((family) => (
              <option key={family} value={family} style={{ fontFamily: family }}>
                {family.split(',')[0]}
              </option>
            ))}
          </select>
          <select className={`${SELECT} w-[68px]`} aria-label="Font size" value={text.fontSize} onChange={(e) => engine?.setOptions({ text: { fontSize: Number(e.target.value) } })}>
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-0.5">
            <button type="button" className={TOGGLE_BTN} aria-pressed={text.bold} aria-label="Bold (Ctrl+B)" onClick={() => engine?.setOptions({ text: { bold: !text.bold } })}><Bold /></button>
            <button type="button" className={TOGGLE_BTN} aria-pressed={text.italic} aria-label="Italic (Ctrl+I)" onClick={() => engine?.setOptions({ text: { italic: !text.italic } })}><Italic /></button>
            <button type="button" className={TOGGLE_BTN} aria-pressed={text.underline} aria-label="Underline (Ctrl+U)" onClick={() => engine?.setOptions({ text: { underline: !text.underline } })}><Underline /></button>
            <button type="button" className={TOGGLE_BTN} aria-pressed={text.strike} aria-label="Strikethrough" onClick={() => engine?.setOptions({ text: { strike: !text.strike } })}><Strikethrough /></button>
          </div>
          <label className="ml-1 flex items-center gap-1.5 text-[0.78rem] text-ink-muted">
            <input type="checkbox" checked={text.opaque} onChange={(e) => engine?.setOptions({ text: { opaque: e.target.checked } })} className="accent-mq-red" />
            Opaque box
          </label>
        </>
      )}

      {selecting && (
        <>
          <Divider />
          <div className="flex items-center gap-0.5">
            <button type="button" className={ICON_BTN} aria-label="Rotate counterclockwise 90°" onClick={() => engine?.rotate('ccw')}><RotateCcw /></button>
            <button type="button" className={ICON_BTN} aria-label="Rotate clockwise 90°" onClick={() => engine?.rotate('cw')}><RotateCw /></button>
            <button type="button" className={ICON_BTN} aria-label="Flip horizontal" onClick={() => engine?.flip('horizontal')}><FlipHorizontal2 /></button>
            <button type="button" className={ICON_BTN} aria-label="Flip vertical" onClick={() => engine?.flip('vertical')}><FlipVertical2 /></button>
            <button type="button" className={ICON_BTN} aria-label="Invert colors (Ctrl+I)" onClick={() => engine?.invert()}><Contrast /></button>
            <button type="button" className={ICON_BTN} aria-label="Select all (Ctrl+A)" onClick={() => engine?.selectAll()}><SquareDashed /></button>
          </div>
        </>
      )}
    </div>
  );
}
