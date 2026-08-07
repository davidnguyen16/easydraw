'use client';

import { useEffect, useState } from 'react';
import { FolderOpen, Save } from 'lucide-react';
import UiIcon from '@/lib/components/icons/UiIcon';
import { FONT_FAMILIES } from '@/lib/fonts';
import { MAX_ZOOM_PERCENT, MIN_ZOOM_PERCENT, ZOOM_PRESETS } from '@/lib/flow/zoom';
import { useEditor } from '@/lib/flow/EditorContext';

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 24, 36, 48, 64];
const SIZE_MIN = 1;
const SIZE_MAX = 96;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const ICON_BTN =
  'tb-tip relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border ' +
  'border-transparent bg-transparent p-0 text-toolbar-text transition-colors duration-[120ms] ' +
  '[&_svg]:size-[18px] enabled:hover:bg-surface-hover enabled:hover:text-[#1f201d] ' +
  'disabled:cursor-not-allowed disabled:opacity-[0.32] [&.toggled]:bg-mq-pink [&.toggled]:text-mq-red';
const FMT_BTN =
  'tb-tip-data relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border ' +
  'border-transparent bg-transparent p-0 text-toolbar-text transition-colors duration-[120ms] ' +
  'hover:bg-surface-hover hover:text-[#1f201d] [&.toggled]:bg-mq-pink [&.toggled]:text-mq-red';

function icon(name: string) {
  return <UiIcon name={name} strokeWidth={1.8} />;
}

export default function ToolBar() {
  const editor = useEditor();

  const [openDropdown, setOpenDropdown] = useState<'zoom' | 'font' | 'size' | null>(null);
  const [zoomDraft, setZoomDraft] = useState<string | null>(null);
  const [sizeDraft, setSizeDraft] = useState<string | null>(null);
  const [liveTextColor, setLiveTextColor] = useState<string | null>(null);

  const toggle = (name: 'zoom' | 'font' | 'size') =>
    setOpenDropdown((cur) => (cur === name ? null : name));
  const closeDropdowns = () => setOpenDropdown(null);

  const style = editor.nodeStyle ?? {
    fontFamily: 'Inter',
    fontSize: 14,
    bold: false,
    italic: false,
    underline: false,
    textColor: '#2c2c2a',
  };
  const swatchColor = liveTextColor ?? style.textColor;

  // Drop any live preview the moment neither font nor size dropdown is open.
  useEffect(() => {
    if (openDropdown !== 'font' && openDropdown !== 'size') editor.endPreview();
  }, [openDropdown, editor]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.tb-menu')) return;
      closeDropdowns();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDropdowns();
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  function pickZoom(percent: number) {
    editor.setZoom(percent);
    closeDropdowns();
  }
  function pickFont(family: string) {
    editor.applyStyle({ fontFamily: family });
    closeDropdowns();
  }
  function pickSize(size: number) {
    editor.applyStyle({ fontSize: size });
    closeDropdowns();
  }

  function commitZoom() {
    if (zoomDraft !== null) {
      const n = parseInt(zoomDraft, 10);
      if (!Number.isNaN(n)) editor.setZoom(clamp(n, MIN_ZOOM_PERCENT, MAX_ZOOM_PERCENT));
    }
    setZoomDraft(null);
  }
  function commitSize() {
    if (sizeDraft !== null) {
      const n = parseInt(sizeDraft, 10);
      if (!Number.isNaN(n)) editor.applyStyle({ fontSize: clamp(n, SIZE_MIN, SIZE_MAX) });
    }
    setSizeDraft(null);
  }

  function onNumberKeydown(
    event: React.KeyboardEvent<HTMLInputElement>,
    commit: () => void,
    cancel: () => void,
  ) {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
      event.currentTarget.blur();
    }
  }

  function focusNumber(
    event: React.FocusEvent<HTMLInputElement>,
    set: (v: string) => void,
    current: number,
  ) {
    closeDropdowns();
    set(`${current}`);
    event.currentTarget.select();
  }

  function onTextColorInput(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    setLiveTextColor(value);
    editor.applyStyle({ textColor: value });
  }

  return (
    <div className="relative flex w-full flex-[0_0_46px] items-center gap-1 border-b border-line-soft bg-white py-0 pr-14 pl-3 [font-family:system-ui,-apple-system,sans-serif]">
      {/* File */}
      <div className="flex items-center gap-0.5">
        <button type="button" className={ICON_BTN} aria-label="Open file" onClick={editor.open}>
          <FolderOpen size={18} />
        </button>
        <button type="button" className={ICON_BTN} aria-label="Save" onClick={editor.save}>
          <Save size={18} />
        </button>
      </div>

      <div className="mx-1.5 h-[22px] w-px bg-line-soft" />

      {/* History */}
      <div className="flex items-center gap-0.5">
        <button type="button" className={ICON_BTN} aria-label="Undo" onClick={editor.undo} disabled={!editor.history.canUndo}>
          {icon('undo')}
        </button>
        <button type="button" className={ICON_BTN} aria-label="Redo" onClick={editor.redo} disabled={!editor.history.canRedo}>
          {icon('redo')}
        </button>
      </div>

      <div className="mx-1.5 h-[22px] w-px bg-line-soft" />

      {/* Zoom */}
      <div className="flex items-center gap-0.5">
        <button type="button" className={ICON_BTN} aria-label="Zoom out" onClick={editor.zoomOut}>
          {icon('zoom-out')}
        </button>

        <div className="tb-menu relative">
          <div
            className={`group inline-flex h-[30px] min-w-[64px] items-center rounded-md border border-line-soft bg-transparent pr-0.5 pl-2 transition-colors duration-[120ms] hover:bg-surface-hover focus-within:border-mq-red focus-within:bg-white [&.active]:border-mq-red [&.active]:bg-white ${openDropdown === 'zoom' ? 'active' : ''}`}
          >
            <input
              className="w-0 min-w-[26px] flex-1 border-none bg-transparent p-0 text-right text-[0.82rem] tabular-nums text-toolbar-text outline-none [appearance:textfield] group-focus-within:text-[#1f201d] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              type="text"
              inputMode="numeric"
              aria-label="Zoom level"
              value={zoomDraft ?? `${editor.state.zoomPercent}`}
              onChange={(e) => setZoomDraft(e.currentTarget.value)}
              onFocus={(e) => focusNumber(e, setZoomDraft, editor.state.zoomPercent)}
              onBlur={commitZoom}
              onKeyDown={(e) => onNumberKeydown(e, commitZoom, () => setZoomDraft(null))}
            />
            <span className="pointer-events-none mr-px ml-0.5 text-[0.82rem] text-ink-muted">%</span>
            <button
              type="button"
              className="inline-flex h-full w-4 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-ink-muted hover:text-toolbar-text [&_svg]:size-3"
              aria-label="Zoom presets"
              aria-haspopup="menu"
              aria-expanded={openDropdown === 'zoom'}
              onClick={() => toggle('zoom')}
            >
              {icon('chevron')}
            </button>
          </div>

          {openDropdown === 'zoom' && (
            <div className="absolute top-[calc(100%+6px)] left-0 z-[100] flex max-h-[320px] min-w-[180px] flex-col gap-px overflow-y-auto rounded-[10px] border border-line-dropdown bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]" role="menu">
              <div className="px-3 pt-1.5 pb-1 text-[0.66rem] font-bold tracking-[0.08em] text-ink-muted">ZOOM LEVEL</div>
              {ZOOM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  role="menuitem"
                  className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent px-3 py-[7px] text-left text-[0.86rem] text-ink-soft transition-colors duration-100 hover:bg-mq-pink hover:text-mq-maroon [&.checked]:bg-mq-pink [&.checked]:text-mq-maroon ${preset === editor.state.zoomPercent ? 'checked' : ''}`}
                  onClick={() => pickZoom(preset)}
                >
                  <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-mq-maroon [&_svg]:size-3.5">
                    {preset === editor.state.zoomPercent && icon('check')}
                  </span>
                  <span className="flex-1 text-left tabular-nums">{preset}%</span>
                </button>
              ))}
              <div className="mx-1 my-1 h-px bg-[#e8e5de]" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent px-3 py-[7px] text-left text-[0.86rem] text-ink-soft transition-colors duration-100 hover:bg-mq-pink hover:text-mq-maroon"
                onClick={() => {
                  editor.fitView();
                  closeDropdowns();
                }}
              >
                <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-[#5a5c58] [&_svg]:size-[15px]">{icon('fit')}</span>
                <span className="flex-1 text-left">Fit to screen</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent px-3 py-[7px] text-left text-[0.86rem] text-ink-soft transition-colors duration-100 hover:bg-mq-pink hover:text-mq-maroon"
                onClick={() => {
                  editor.fitSelection();
                  closeDropdowns();
                }}
              >
                <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-[#5a5c58] [&_svg]:size-[15px]">{icon('fit')}</span>
                <span className="flex-1 text-left">Fit selection</span>
              </button>
            </div>
          )}
        </div>

        <button type="button" className={ICON_BTN} aria-label="Zoom in" onClick={editor.zoomIn}>
          {icon('zoom-in')}
        </button>
        <button type="button" className={ICON_BTN} aria-label="Fit to screen" onClick={editor.fitView}>
          {icon('fullscreen')}
        </button>
      </div>

      <div className="mx-1.5 h-[22px] w-px bg-line-soft" />

      {/* Text formatting */}
      <div className="flex items-center gap-0.5">
        <div className="tb-menu relative">
          <button
            type="button"
            className={`inline-flex h-[30px] min-w-[104px] cursor-pointer items-center gap-1.5 rounded-md border border-line-soft bg-transparent px-2 text-[0.82rem] text-toolbar-text transition-colors duration-[120ms] hover:bg-surface-hover hover:text-[#1f201d] [&.active]:border-mq-red [&.active]:bg-white [&.active]:text-mq-maroon ${openDropdown === 'font' ? 'active' : ''}`}
            aria-haspopup="menu"
            aria-expanded={openDropdown === 'font'}
            onClick={() => toggle('font')}
          >
            <span className="flex-1 overflow-hidden text-left text-ellipsis whitespace-nowrap" style={{ fontFamily: style.fontFamily }}>
              {style.fontFamily}
            </span>
            <span className="inline-flex h-3 w-3 text-ink-muted [&_svg]:size-3">{icon('chevron')}</span>
          </button>
          {openDropdown === 'font' && (
            <div
              className="absolute top-[calc(100%+6px)] left-0 z-[100] flex max-h-[320px] min-w-[180px] flex-col gap-px overflow-y-auto rounded-[10px] border border-line-dropdown bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
              role="menu"
              tabIndex={-1}
              onMouseLeave={() => editor.endPreview()}
            >
              {FONT_FAMILIES.map((family) => (
                <button
                  key={family}
                  type="button"
                  role="menuitem"
                  className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent px-3 py-[7px] text-left text-[0.86rem] text-ink-soft transition-colors duration-100 hover:bg-mq-pink hover:text-mq-maroon [&.checked]:bg-mq-pink [&.checked]:text-mq-maroon ${family === style.fontFamily ? 'checked' : ''}`}
                  onClick={() => pickFont(family)}
                  onMouseEnter={() => editor.previewStyle({ fontFamily: family })}
                >
                  <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-mq-maroon [&_svg]:size-3.5">
                    {family === style.fontFamily && icon('check')}
                  </span>
                  <span className="flex-1 text-left" style={{ fontFamily: family }}>{family}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="tb-menu relative">
          <div
            className={`group inline-flex h-[30px] min-w-[56px] items-center rounded-md border border-line-soft bg-transparent pr-0.5 pl-2 transition-colors duration-[120ms] hover:bg-surface-hover focus-within:border-mq-red focus-within:bg-white [&.active]:border-mq-red [&.active]:bg-white ${openDropdown === 'size' ? 'active' : ''}`}
          >
            <input
              className="w-0 min-w-[26px] flex-1 border-none bg-transparent p-0 text-right text-[0.82rem] tabular-nums text-toolbar-text outline-none [appearance:textfield] group-focus-within:text-[#1f201d] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              type="text"
              inputMode="numeric"
              aria-label="Font size"
              value={sizeDraft ?? `${style.fontSize}`}
              onChange={(e) => setSizeDraft(e.currentTarget.value)}
              onFocus={(e) => focusNumber(e, setSizeDraft, style.fontSize)}
              onBlur={commitSize}
              onKeyDown={(e) => onNumberKeydown(e, commitSize, () => setSizeDraft(null))}
            />
            <span className="pointer-events-none mr-px ml-0.5 text-[0.82rem] text-ink-muted">pt</span>
            <button
              type="button"
              className="inline-flex h-full w-4 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-ink-muted hover:text-toolbar-text [&_svg]:size-3"
              aria-label="Font size presets"
              aria-haspopup="menu"
              aria-expanded={openDropdown === 'size'}
              onClick={() => toggle('size')}
            >
              {icon('chevron')}
            </button>
          </div>
          {openDropdown === 'size' && (
            <div
              className="absolute top-[calc(100%+6px)] left-0 z-[100] flex max-h-[320px] min-w-[120px] flex-col gap-px overflow-y-auto rounded-[10px] border border-line-dropdown bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
              role="menu"
              tabIndex={-1}
              onMouseLeave={() => editor.endPreview()}
            >
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  role="menuitem"
                  className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent px-3 py-[7px] text-left text-[0.86rem] text-ink-soft transition-colors duration-100 hover:bg-mq-pink hover:text-mq-maroon [&.checked]:bg-mq-pink [&.checked]:text-mq-maroon ${size === style.fontSize ? 'checked' : ''}`}
                  onClick={() => pickSize(size)}
                  onMouseEnter={() => editor.previewStyle({ fontSize: size })}
                >
                  <span className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-mq-maroon [&_svg]:size-3.5">
                    {size === style.fontSize && icon('check')}
                  </span>
                  <span className="flex-1 text-left tabular-nums">{size} pt</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className={`${FMT_BTN} ${style.bold ? 'toggled' : ''}`}
          aria-label="Bold"
          data-tip="Bold (Ctrl+B)"
          aria-pressed={style.bold}
          onClick={() => editor.applyStyle({ bold: !style.bold })}
        >
          <span className="text-[0.95rem] leading-none font-bold">B</span>
        </button>
        <button
          type="button"
          className={`${FMT_BTN} ${style.italic ? 'toggled' : ''}`}
          aria-label="Italic"
          data-tip="Italic (Ctrl+I)"
          aria-pressed={style.italic}
          onClick={() => editor.applyStyle({ italic: !style.italic })}
        >
          <span className="text-[0.95rem] leading-none font-semibold italic [font-family:Georgia,serif]">I</span>
        </button>
        <button
          type="button"
          className={`${FMT_BTN} ${style.underline ? 'toggled' : ''}`}
          aria-label="Underline"
          data-tip="Underline (Ctrl+U)"
          aria-pressed={style.underline}
          onClick={() => editor.applyStyle({ underline: !style.underline })}
        >
          <span className="text-[0.95rem] leading-none font-semibold underline">U</span>
        </button>

        <label className={`${FMT_BTN} flex-col gap-px`} aria-label="Text color" data-tip="Text color">
          <span className="text-[0.9rem] leading-none font-bold">A</span>
          <span className="h-[3px] w-4 rounded-[1px]" style={{ background: swatchColor }} />
          <input
            className="absolute inset-0 h-full w-full cursor-pointer border-none p-0 opacity-0"
            type="color"
            value={swatchColor}
            onChange={onTextColorInput}
            onBlur={() => setLiveTextColor(null)}
          />
        </label>
      </div>

      <div className="mx-1.5 h-[22px] w-px bg-line-soft" />

      {/* Object */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={`${ICON_BTN} ${editor.state.locked ? 'toggled' : ''}`}
          aria-label={editor.state.locked ? 'Unlock canvas' : 'Lock canvas'}
          aria-pressed={editor.state.locked}
          onClick={editor.toggleLock}
        >
          {icon(editor.state.locked ? 'lock-closed' : 'lock-open')}
        </button>
        <button type="button" className={ICON_BTN} aria-label="Copy" onClick={editor.copy}>
          {icon('copy')}
        </button>
        <button type="button" className={ICON_BTN} aria-label="Delete" onClick={editor.deleteSelected}>
          {icon('delete')}
        </button>
      </div>

      {/* Style-panel toggle: pinned to the toolbar's right corner. */}
      <div className="absolute top-1/2 right-3 -translate-y-1/2">
        <button
          type="button"
          className={`${ICON_BTN} ${editor.state.showStylePanel ? 'toggled' : ''}`}
          aria-label={editor.state.showStylePanel ? 'Hide style panel' : 'Show style panel'}
          aria-pressed={editor.state.showStylePanel}
          onClick={editor.toggleStylePanel}
        >
          {icon('style-panel')}
        </button>
      </div>
    </div>
  );
}
