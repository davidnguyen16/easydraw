'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ColorField from '@/lib/components/ColorField';
import type { NodeStyleData } from './types';
import {
  GROUP,
  GROUP_LABEL,
  ROW,
  ROW_LABEL,
  STEPPER,
  STEPPER_BTN,
  SIZE_INPUT,
  TOGGLE,
  TOGGLE_SLIDER,
} from './ui';

interface Props {
  style: NodeStyleData;
  onStyleChange: (patch: Partial<NodeStyleData>) => void;
}

// FILL palette pages (draw.io-style ◀ ▶ pager). Page 0 is the brand default
// set the panel opens on — white leads because it's the actual default fill.
const FILL_SWATCH_PAGES: string[][] = [
  ['#FFFFFF', '#76232F', '#A6192E', '#6B4DBA', '#0E7E63', '#9C6B1A'], // defaults
  ['#E53935', '#FF6347', '#FF7F0E', '#FB8C00', '#FFC107', '#FFD700'], // reds & oranges
  ['#FFEB3B', '#CDDC39', '#8BC34A', '#4CAF50', '#2E7D32', '#009688'], // yellows & greens
  ['#00BCD4', '#4FC3F7', '#2196F3', '#1F77B4', '#1A237E', '#3F51B5'], // cyans & blues
  ['#673AB7', '#9C27B0', '#E91E63', '#795548', '#9E9E9E', '#2C2C2A'], // purples, pink & neutrals
];
const LAST_FILL_PAGE = FILL_SWATCH_PAGES.length - 1;

// Arrow buttons flanking the swatch row; stretch to swatch height, dimmed at ends.
const FILL_ARROW = [
  'flex w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded border-none',
  'bg-transparent text-ink-muted transition-colors duration-[120ms]',
  'hover:bg-surface-hover hover:text-mq-maroon',
  'disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted',
].join(' ');

// Fill swatches: square, width auto-fills the grid cell so all six sit in one
// row with the arrows; gap-1 shows a real gap between them.
const FILL_SWATCH = [
  'aspect-square w-full cursor-pointer rounded border border-transparent p-0',
  'transition-[transform,box-shadow] duration-100 hover:-translate-y-px',
].join(' ');

const BORDER_WIDTH_MAX = 10;
const OPACITY_MIN = 0;
const OPACITY_MAX = 100;

export default function StyleTab({ style, onStyleChange }: Props) {
  // Which palette page is showing. Component-local state → resets to 0 every
  // time this tab (re)mounts (toggling the style panel off/on unmounts it).
  const [fillPage, setFillPage] = useState(0);
  const fillColors = FILL_SWATCH_PAGES[fillPage];

  const fillColor = style.fillColor ?? '#FFFFFF';
  const borderColor = style.borderColor ?? '#2C2C2A';
  const borderWidth = style.borderWidth ?? 1;
  const shadow = style.shadow ?? false;
  const opacity = Math.max(0, Math.min(100, style.opacity ?? 100));

  function adjustBorderWidth(delta: number) {
    const next = Math.max(0, Math.min(BORDER_WIDTH_MAX, borderWidth + delta));
    onStyleChange({ borderWidth: next });
  }

  const [borderWidthDraft, setBorderWidthDraft] = useState<string | null>(null);

  function commitBorderWidth() {
    if (borderWidthDraft !== null) {
      const n = parseFloat(borderWidthDraft);
      if (!Number.isNaN(n)) {
        onStyleChange({ borderWidth: Math.max(0, Math.min(BORDER_WIDTH_MAX, n)) });
      }
    }
    setBorderWidthDraft(null);
  }

  function onBorderWidthKeydown(event: React.KeyboardEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (event.key === 'Enter') {
      event.preventDefault();
      commitBorderWidth();
      input.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setBorderWidthDraft(null);
      input.blur();
    }
  }

  const clampOpacity = (value: number) => Math.max(OPACITY_MIN, Math.min(OPACITY_MAX, value));
  const [opacityDraft, setOpacityDraft] = useState<string | null>(null);

  function commitOpacity() {
    if (opacityDraft !== null) {
      const n = parseFloat(opacityDraft);
      if (!Number.isNaN(n)) onStyleChange({ opacity: clampOpacity(n) });
    }
    setOpacityDraft(null);
  }

  function onOpacityKeydown(event: React.KeyboardEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (event.key === 'Enter') {
      event.preventDefault();
      commitOpacity();
      input.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpacityDraft(null);
      input.blur();
    }
  }

  return (
    <>
      <section className={GROUP}>
        <h3 className={GROUP_LABEL}>FILL</h3>
        <div className="flex items-stretch gap-1">
          <button
            type="button"
            className={FILL_ARROW}
            aria-label="Previous colours"
            disabled={fillPage === 0}
            onClick={() => setFillPage(Math.max(0, fillPage - 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="grid flex-1 grid-cols-6 gap-1">
            {fillColors.map((color) => (
              <button
                key={color}
                type="button"
                className={`${FILL_SWATCH} ${color === '#FFFFFF' ? 'border-line' : ''} ${
                  fillColor.toUpperCase() === color ? 'shadow-[0_0_0_2px_#76232f]' : ''
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Fill ${color}`}
                onClick={() => onStyleChange({ fillColor: color })}
              />
            ))}
          </div>
          <button
            type="button"
            className={FILL_ARROW}
            aria-label="More colours"
            disabled={fillPage === LAST_FILL_PAGE}
            onClick={() => setFillPage(Math.min(LAST_FILL_PAGE, fillPage + 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className={ROW}>
          <span className={ROW_LABEL}>Custom</span>
          <ColorField value={fillColor} label="Fill" onChange={(hex) => onStyleChange({ fillColor: hex })} />
        </div>
      </section>

      <section className={GROUP}>
        <h3 className={GROUP_LABEL}>BORDER</h3>
        <div className={ROW}>
          <span className={ROW_LABEL}>Color</span>
          <ColorField value={borderColor} label="Border" onChange={(hex) => onStyleChange({ borderColor: hex })} />
        </div>
        <div className={ROW}>
          <span className={ROW_LABEL}>Width</span>
          <div className={STEPPER}>
            <button type="button" className={STEPPER_BTN} aria-label="Decrease width" onClick={() => adjustBorderWidth(-1)}>
              −
            </button>
            <input
              className={SIZE_INPUT}
              type="text"
              inputMode="decimal"
              aria-label="Border width"
              value={borderWidthDraft ?? `${borderWidth}`}
              onChange={(e) => setBorderWidthDraft(e.currentTarget.value)}
              onFocus={(e) => {
                setBorderWidthDraft(`${borderWidth}`);
                e.currentTarget.select();
              }}
              onBlur={commitBorderWidth}
              onKeyDown={onBorderWidthKeydown}
            />
            <button type="button" className={STEPPER_BTN} aria-label="Increase width" onClick={() => adjustBorderWidth(1)}>
              +
            </button>
          </div>
        </div>
      </section>

      <section className={GROUP}>
        <h3 className={GROUP_LABEL}>EFFECTS</h3>
        <div className="flex flex-col gap-2">
          <div className={ROW}>
            <span className={ROW_LABEL}>Opacity</span>
            <label
              className="inline-flex h-[30px] min-w-[58px] items-center rounded-md border border-line
                bg-white px-2 text-[0.78rem] font-medium tabular-nums text-ink-soft
                focus-within:border-mq-red"
            >
              <input
                className="w-8 min-w-0 border-none bg-transparent p-0 text-right text-[0.78rem]
                  font-medium tabular-nums text-ink-soft outline-none [appearance:textfield]
                  [&::-webkit-inner-spin-button]:appearance-none
                  [&::-webkit-outer-spin-button]:appearance-none"
                type="text"
                inputMode="decimal"
                aria-label="Opacity percentage"
                value={opacityDraft ?? `${opacity}`}
                onChange={(e) => setOpacityDraft(e.currentTarget.value)}
                onFocus={(e) => {
                  setOpacityDraft(`${opacity}`);
                  e.currentTarget.select();
                }}
                onBlur={commitOpacity}
                onKeyDown={onOpacityKeydown}
              />
              <span className="pl-0.5 text-ink-muted">%</span>
            </label>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={opacity}
            aria-label="Opacity"
            aria-valuetext={`${opacity}%`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e8e5de]
              accent-mq-red outline-none
              [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-mq-red
              [&::-moz-range-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.25)]
              [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
              [&::-webkit-slider-thumb]:bg-mq-red
              [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
            style={{
              background: `linear-gradient(to right, #a6192e 0%, #a6192e ${opacity}%, #e8e5de ${opacity}%, #e8e5de 100%)`,
            }}
            onChange={(e) => {
              setOpacityDraft(null);
              onStyleChange({ opacity: e.currentTarget.valueAsNumber });
            }}
          />
        </div>
        <div className={ROW}>
          <span className={ROW_LABEL}>Shadow</span>
          <label className={TOGGLE}>
            <input
              className="peer h-0 w-0 opacity-0"
              type="checkbox"
              checked={shadow}
              onChange={(e) => onStyleChange({ shadow: e.currentTarget.checked })}
            />
            <span className={TOGGLE_SLIDER} />
          </label>
        </div>
      </section>
    </>
  );
}
