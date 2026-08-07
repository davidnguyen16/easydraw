'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import ColorField from '@/lib/components/ColorField';
import { FONT_FAMILIES, DEFAULT_FONT_FAMILY } from '@/lib/fonts';
import type { NodeStyleData, TextAlign } from './types';
import {
  GROUP,
  GROUP_LABEL,
  ROW,
  ROW_LABEL,
  STEPPER,
  STEPPER_BTN,
  SIZE_INPUT,
  SQUARE_BTN,
  SWATCH,
} from './ui';

interface Props {
  style: NodeStyleData;
  onStyleChange: (patch: Partial<NodeStyleData>) => void;
  onFontPreview: (family: string) => void;
  onFontPreviewEnd: () => void;
}

const TEXT_COLORS = ['#2C2C2A', '#FFFFFF', '#A6192E', '#6B4DBA', '#0E7E63', '#9C6B1A'];
const TEXT_ALIGNMENTS: TextAlign[] = ['left', 'center', 'right'];

const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 96;
const FONT_MENU_MAX_H = 280;

export default function TextTab({ style, onStyleChange, onFontPreview, onFontPreviewEnd }: Props) {
  const textColor = style.textColor ?? '#2C2C2A';
  const fontFamily = style.fontFamily ?? DEFAULT_FONT_FAMILY;
  const fontSize = style.fontSize ?? 14;
  const bold = style.bold ?? false;
  const italic = style.italic ?? false;
  const underline = style.underline ?? false;
  const textAlign: TextAlign = style.textAlign ?? 'center';

  function adjustFontSize(delta: number) {
    const next = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, fontSize + delta));
    onStyleChange({ fontSize: next });
  }

  const [sizeDraft, setSizeDraft] = useState<string | null>(null);

  function commitFontSize() {
    if (sizeDraft !== null) {
      const n = parseInt(sizeDraft, 10);
      if (!Number.isNaN(n)) {
        onStyleChange({ fontSize: Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, n)) });
      }
    }
    setSizeDraft(null);
  }

  function onSizeKeydown(event: React.KeyboardEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (event.key === 'Enter') {
      event.preventDefault();
      commitFontSize();
      input.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setSizeDraft(null);
      input.blur();
    }
  }

  // ─── Font family dropdown (custom menu with live typeface preview) ──
  // Not a native <select>: Chromium paints option popups with the OS control,
  // ignoring per-option font-family. The menu escapes the panel's
  // overflow:hidden via position:fixed, coordinates computed from the trigger.
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [fontMenuStyle, setFontMenuStyle] = useState<CSSProperties>({});
  const fontTriggerRef = useRef<HTMLButtonElement>(null);
  const fontMenuRef = useRef<HTMLDivElement>(null);

  function toggleFontMenu() {
    if (fontMenuOpen) {
      setFontMenuOpen(false);
      return;
    }
    const rect = fontTriggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Drop below the trigger; flip above when the space below is too tight.
    const openUp = window.innerHeight - rect.bottom < FONT_MENU_MAX_H + 12;
    setFontMenuStyle({
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      ...(openUp
        ? { bottom: `${window.innerHeight - rect.top + 4}px` }
        : { top: `${rect.bottom + 4}px` }),
      maxHeight: `${FONT_MENU_MAX_H}px`,
    });
    setFontMenuOpen(true);
  }

  function pickFont(family: string) {
    onStyleChange({ fontFamily: family });
    setFontMenuOpen(false);
  }

  // While open: close on outside click, Escape, or any scroll outside the menu.
  useEffect(() => {
    if (!fontMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node) {
        if (fontTriggerRef.current?.contains(e.target) || fontMenuRef.current?.contains(e.target))
          return;
      }
      setFontMenuOpen(false);
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFontMenuOpen(false);
    };
    const onScroll = (e: Event) => {
      if (fontMenuRef.current && e.target instanceof Node && fontMenuRef.current.contains(e.target))
        return;
      setFontMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeydown, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeydown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [fontMenuOpen]);

  // Whenever the menu closes — commit, outside click, Escape, scroll — drop any
  // live preview so the label snaps back to its committed / just-picked font.
  useEffect(() => {
    if (!fontMenuOpen) onFontPreviewEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontMenuOpen]);

  return (
    <>
      <section className={GROUP}>
        <h3 className={GROUP_LABEL}>COLOR</h3>
        <div className="grid grid-cols-6 gap-1.5">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`${SWATCH} ${color === '#FFFFFF' ? 'border-line' : ''} ${
                textColor.toUpperCase() === color ? 'shadow-[0_0_0_2px_#76232f]' : ''
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Text color ${color}`}
              onClick={() => onStyleChange({ textColor: color })}
            />
          ))}
        </div>
        <div className={ROW}>
          <span className={ROW_LABEL}>Custom</span>
          <ColorField value={textColor} label="Text" onChange={(hex) => onStyleChange({ textColor: hex })} />
        </div>
      </section>

      <section className={GROUP}>
        <h3 className={GROUP_LABEL}>FONT</h3>
        <div className="relative">
          <button
            type="button"
            className="w-full cursor-pointer appearance-none overflow-hidden rounded-md border
              border-line bg-white py-[9px] pr-[30px] pl-2.5 text-left text-[0.9rem] leading-[1.2]
              text-ellipsis whitespace-nowrap text-ink-soft hover:border-[#c4c1b8]
              focus:border-mq-red focus:outline-none"
            ref={fontTriggerRef}
            style={{ fontFamily }}
            aria-haspopup="listbox"
            aria-expanded={fontMenuOpen}
            aria-label="Font family"
            onClick={toggleFontMenu}
          >
            {fontFamily}
          </button>
          <span
            className="pointer-events-none absolute top-1/2 right-2.5 inline-flex -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
          {fontMenuOpen ? (
            <div
              className="fixed z-[120] flex flex-col gap-0.5 overflow-y-auto rounded-lg border border-line
                bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
              role="listbox"
              tabIndex={-1}
              aria-label="Font families"
              ref={fontMenuRef}
              style={fontMenuStyle}
              onMouseLeave={() => onFontPreviewEnd()}
            >
              {FONT_FAMILIES.map((family) => (
                <button
                  key={family}
                  type="button"
                  role="option"
                  aria-selected={family === fontFamily}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent
                    px-2.5 py-[7px] text-left text-[0.9rem] whitespace-nowrap text-ink-soft
                    hover:bg-[#f3f1ea]"
                  onClick={() => pickFont(family)}
                  onMouseEnter={() => onFontPreview(family)}
                >
                  <span className="inline-flex w-3.5 flex-shrink-0 text-mq-red">
                    {family === fontFamily ? (
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </span>
                  <span style={{ fontFamily: family }}>{family}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className={ROW}>
          <span className={ROW_LABEL}>Size</span>
          <div className={STEPPER}>
            <button type="button" className={STEPPER_BTN} aria-label="Decrease font size" onClick={() => adjustFontSize(-1)}>
              −
            </button>
            <input
              className={SIZE_INPUT}
              type="text"
              inputMode="numeric"
              aria-label="Font size"
              value={sizeDraft ?? `${fontSize}`}
              onChange={(e) => setSizeDraft(e.currentTarget.value)}
              onFocus={(e) => {
                setSizeDraft(`${fontSize}`);
                e.currentTarget.select();
              }}
              onBlur={commitFontSize}
              onKeyDown={onSizeKeydown}
            />
            <button type="button" className={STEPPER_BTN} aria-label="Increase font size" onClick={() => adjustFontSize(1)}>
              +
            </button>
          </div>
        </div>
      </section>

      <section className={GROUP}>
        <h3 className={GROUP_LABEL}>STYLE</h3>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            className={`${SQUARE_BTN} ${bold ? 'border-mq-red bg-mq-pink text-mq-maroon' : ''}`}
            aria-label="Bold"
            aria-pressed={bold}
            onClick={() => onStyleChange({ bold: !bold })}
          >
            <span style={{ fontWeight: 700 }}>B</span>
          </button>
          <button
            type="button"
            className={`${SQUARE_BTN} ${italic ? 'border-mq-red bg-mq-pink text-mq-maroon' : ''}`}
            aria-label="Italic"
            aria-pressed={italic}
            onClick={() => onStyleChange({ italic: !italic })}
          >
            <span style={{ fontStyle: 'italic' }}>I</span>
          </button>
          <button
            type="button"
            className={`${SQUARE_BTN} ${underline ? 'border-mq-red bg-mq-pink text-mq-maroon' : ''}`}
            aria-label="Underline"
            aria-pressed={underline}
            onClick={() => onStyleChange({ underline: !underline })}
          >
            <span style={{ textDecoration: 'underline' }}>U</span>
          </button>
        </div>
      </section>

      <section className={GROUP}>
        <h3 className={GROUP_LABEL}>ALIGNMENT</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {TEXT_ALIGNMENTS.map((align) => (
            <button
              key={align}
              type="button"
              className={`${SQUARE_BTN} ${textAlign === align ? 'border-mq-red bg-mq-pink text-mq-maroon' : ''}`}
              aria-label={`Align ${align}`}
              aria-pressed={textAlign === align}
              onClick={() => onStyleChange({ textAlign: align })}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                {align === 'left' ? (
                  <>
                    <line x1="4" y1="7" x2="20" y2="7" />
                    <line x1="4" y1="12" x2="14" y2="12" />
                    <line x1="4" y1="17" x2="18" y2="17" />
                  </>
                ) : align === 'center' ? (
                  <>
                    <line x1="4" y1="7" x2="20" y2="7" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                    <line x1="5" y1="17" x2="19" y2="17" />
                  </>
                ) : (
                  <>
                    <line x1="4" y1="7" x2="20" y2="7" />
                    <line x1="10" y1="12" x2="20" y2="12" />
                    <line x1="6" y1="17" x2="20" y2="17" />
                  </>
                )}
              </svg>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
