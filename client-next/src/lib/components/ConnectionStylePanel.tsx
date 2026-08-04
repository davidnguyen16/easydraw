'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Edge } from '@xyflow/react';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import LineEndingsDialog from '@/lib/components/LineEndingsDialog';
import MarkerPreview from '@/lib/components/MarkerPreview';
import ColorField from '@/lib/components/ColorField';
import { MARKER_DEFS } from '@/lib/flow/edges/markers';
import { useMarkerPalette } from '@/lib/stores/markers.store';
import {
  FLOATING_STYLE_PANEL_RIGHT_GAP_PX,
  FLOATING_STYLE_PANEL_WIDTH_PX,
} from '@/lib/components/style-panel/layout';
import type { ConnectionEdgeData, EdgeLineStyle, EdgeRouting, MarkerKind } from '@/lib/flow/edges/types';

/**
 * Style panel for a selected CONNECTION edge — the edge counterpart of
 * StylePanel. Every control writes a patch into edge.data via onDataChange.
 * (Port of ConnectionStylePanel.svelte, incl. double-line + colour pager.)
 */
interface Props {
  edge: Edge;
  onDataChange: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}

const DEFAULT_COLOR = '#B4B2A9';
const WIDTH_MIN = 0.5;
const WIDTH_MAX = 10;

const LINE_STYLES: { id: EdgeLineStyle; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'double', label: 'Double' },
];

const ROUTINGS: { id: EdgeRouting; label: string }[] = [
  { id: 'straight', label: 'Straight' },
  { id: 'orthogonal', label: 'Orthogonal' },
  { id: 'curved', label: 'Curved' },
];

const COLOR_PAGES: string[][] = [
  ['#B4B2A9', '#2C2C2A', '#A6192E', '#1F4E9C', '#0F7B5F', '#6B4DBA'], // defaults (grey leads)
  ['#E53935', '#FF6347', '#FF7F0E', '#FB8C00', '#FFC107', '#FFD700'], // reds & oranges
  ['#FFEB3B', '#CDDC39', '#8BC34A', '#4CAF50', '#2E7D32', '#009688'], // yellows & greens
  ['#00BCD4', '#4FC3F7', '#2196F3', '#1F77B4', '#1A237E', '#3F51B5'], // cyans & blues
  ['#673AB7', '#9C27B0', '#E91E63', '#795548', '#9E9E9E', '#2C2C2A'], // purples, pink & neutrals
];
const LAST_COLOR_PAGE = COLOR_PAGES.length - 1;

const COLOR_ARROW =
  'flex w-6 flex-shrink-0 cursor-pointer items-center justify-center rounded border-none ' +
  'bg-transparent text-ink-muted transition-colors duration-[120ms] ' +
  'hover:bg-surface-hover hover:text-mq-maroon ' +
  'disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted';

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function LinePreview({ styleId }: { styleId: EdgeLineStyle }) {
  return (
    <svg viewBox="0 0 44 12" width={44} height={12} aria-hidden="true">
      {styleId === 'double' ? (
        <>
          <line x1={2} y1={4.4} x2={42} y2={4.4} stroke="#2c2c2a" strokeWidth={1.3} />
          <line x1={2} y1={7.6} x2={42} y2={7.6} stroke="#2c2c2a" strokeWidth={1.3} />
        </>
      ) : (
        <line
          x1={2}
          y1={6}
          x2={42}
          y2={6}
          stroke="#2c2c2a"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeDasharray={styleId === 'dashed' ? '7 5' : styleId === 'dotted' ? '0.1 5' : undefined}
        />
      )}
    </svg>
  );
}

function RoutingIcon({ id }: { id: EdgeRouting }) {
  return (
    <svg viewBox="0 0 22 22" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {id === 'straight' ? (
        <>
          <circle cx="4.5" cy="17.5" r="2" fill="currentColor" stroke="none" />
          <line x1="6" y1="16" x2="16" y2="6" />
          <circle cx="17.5" cy="4.5" r="2" fill="currentColor" stroke="none" />
        </>
      ) : id === 'orthogonal' ? (
        <path d="M4,19 L4,13 L10,13 L10,8 L16,8 L16,3" />
      ) : (
        <>
          <circle cx="4.5" cy="17.5" r="2" fill="currentColor" stroke="none" />
          <path d="M6,16 C10,12 10,7 16,5.5" />
          <circle cx="17.5" cy="4.5" r="2" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

export default function ConnectionStylePanel({ edge, onDataChange, onDelete }: Props) {
  const enabled = useMarkerPalette((s) => s.enabled);

  const data = (edge.data ?? {}) as ConnectionEdgeData;
  const markerStart: MarkerKind = data.markerStart ?? 'none';
  const markerEnd: MarkerKind = data.markerEnd ?? 'none';
  const lineStyle: EdgeLineStyle = data.lineStyle ?? 'solid';
  const routing: EdgeRouting = data.routing ?? 'orthogonal';
  const strokeWidth = data.strokeWidth ?? 1.5;
  const strokeColor = (data.strokeColor ?? DEFAULT_COLOR).toUpperCase();

  const enabledMarkers = MARKER_DEFS.filter((d) => enabled.includes(d.id));
  const markersLocked = lineStyle === 'double';

  const [moreOpen, setMoreOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<'start' | 'end' | 'line' | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [colorPage, setColorPage] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const colorSwatches = COLOR_PAGES[colorPage];

  function openMore() {
    setOpenMenu(null);
    setMoreOpen(true);
  }

  function adjustWidth(delta: number) {
    onDataChange({ strokeWidth: Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, strokeWidth + delta)) });
  }

  function toggleMenu(which: 'start' | 'end' | 'line', e: React.MouseEvent) {
    if (openMenu === which) {
      setOpenMenu(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuStyle({ left: rect.left, top: rect.bottom + 4, minWidth: rect.width, maxHeight: 300 });
    setOpenMenu(which);
  }

  function pickMarker(end: 'start' | 'end', kind: MarkerKind) {
    onDataChange(end === 'start' ? { markerStart: kind } : { markerEnd: kind });
    setOpenMenu(null);
  }

  function pickLineStyle(styleId: EdgeLineStyle) {
    onDataChange({ lineStyle: styleId });
    setOpenMenu(null);
  }

  // While a menu is open: close on outside click, Escape, or scroll outside it.
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Element) {
        if (menuRef.current?.contains(e.target) || e.target.closest('.dd-trigger')) return;
      }
      setOpenMenu(null);
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    const onScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setOpenMenu(null);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeydown, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeydown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [openMenu]);

  // If the style flips to double while an endpoint menu is open, close it.
  useEffect(() => {
    if (markersLocked && (openMenu === 'start' || openMenu === 'end')) setOpenMenu(null);
  }, [markersLocked, openMenu]);

  const endpointEnd: 'start' | 'end' | null =
    openMenu === 'start' || openMenu === 'end' ? openMenu : null;
  const currentMarker = endpointEnd === 'start' ? markerStart : markerEnd;

  return (
    <>
      <aside
        className="absolute top-4 z-50 flex max-h-[calc(100%-32px)] flex-col overflow-hidden rounded-xl border border-line bg-panel font-sans shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
        style={{ right: FLOATING_STYLE_PANEL_RIGHT_GAP_PX, width: FLOATING_STYLE_PANEL_WIDTH_PX }}
        aria-label="Connection style"
      >
        <header className="flex flex-shrink-0 items-center gap-2 border-b border-line px-[18px] py-[14px] text-ink-soft">
          <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
            <circle cx="3" cy="13" r="1.8" fill="currentColor" stroke="none" />
            <path d="M4.5,11.5 C7,9 9,7 11.5,4.5" />
            <circle cx="13" cy="3" r="1.8" fill="currentColor" stroke="none" />
          </svg>
          <h2 className="m-0 text-[0.95rem] font-semibold">Connection</h2>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto p-[18px]">
          <section className="flex flex-col gap-2.5">
            <h3 className="m-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">ENDPOINTS</h3>
            <div className={`grid grid-cols-2 gap-2.5 transition-opacity duration-[120ms] ${markersLocked ? 'pointer-events-none opacity-40' : ''}`}>
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.78rem] text-[#6f7068]">Start</span>
                <button
                  type="button"
                  className="dd-trigger flex w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-[9px] text-[0.85rem] text-ink-soft hover:border-[#c4c1b8] focus-visible:border-mq-red focus-visible:outline-none disabled:cursor-not-allowed"
                  aria-haspopup="listbox"
                  aria-expanded={openMenu === 'start'}
                  aria-label="Start endpoint"
                  disabled={markersLocked}
                  onClick={(e) => toggleMenu('start', e)}
                >
                  <MarkerPreview kind={markerStart} end="start" />
                  <span className="ml-auto inline-flex flex-shrink-0 text-ink-muted"><Chevron /></span>
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.78rem] text-[#6f7068]">End</span>
                <button
                  type="button"
                  className="dd-trigger flex w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-[9px] text-[0.85rem] text-ink-soft hover:border-[#c4c1b8] focus-visible:border-mq-red focus-visible:outline-none disabled:cursor-not-allowed"
                  aria-haspopup="listbox"
                  aria-expanded={openMenu === 'end'}
                  aria-label="End endpoint"
                  disabled={markersLocked}
                  onClick={(e) => toggleMenu('end', e)}
                >
                  <MarkerPreview kind={markerEnd} end="end" />
                  <span className="ml-auto inline-flex flex-shrink-0 text-ink-muted"><Chevron /></span>
                </button>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className="m-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">LINE STYLE</h3>
            <button
              type="button"
              className="dd-trigger flex w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-[9px] text-[0.85rem] text-ink-soft hover:border-[#c4c1b8] focus-visible:border-mq-red focus-visible:outline-none"
              aria-haspopup="listbox"
              aria-expanded={openMenu === 'line'}
              aria-label="Line style"
              onClick={(e) => toggleMenu('line', e)}
            >
              <LinePreview styleId={lineStyle} />
              <span className="flex-1 text-left">{LINE_STYLES.find((s) => s.id === lineStyle)?.label}</span>
              <span className="ml-auto inline-flex flex-shrink-0 text-ink-muted"><Chevron /></span>
            </button>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className="m-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">ROUTING</h3>
            <div className="flex gap-2.5">
              {ROUTINGS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border py-2.5 transition-colors duration-[120ms] ${
                    routing === r.id
                      ? 'border-mq-red bg-[#f7e3e4] text-mq-red'
                      : 'border-line bg-white text-[#5f5e5a] hover:border-[#c4c1b8]'
                  }`}
                  aria-pressed={routing === r.id}
                  aria-label={`${r.label} routing`}
                  title={r.label}
                  onClick={() => onDataChange({ routing: r.id })}
                >
                  <RoutingIcon id={r.id} />
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className="m-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">LINE WIDTH</h3>
            <div className="flex items-stretch gap-2.5">
              <button
                type="button"
                className="w-10 cursor-pointer rounded-lg border border-line bg-white text-base leading-none text-ink-soft hover:border-[#c4c1b8] hover:bg-[#faf9f6]"
                aria-label="Decrease line width"
                onClick={() => adjustWidth(-0.5)}
              >
                −
              </button>
              <div className="flex flex-1 items-center justify-center rounded-lg border border-line bg-white py-2.5 text-[0.88rem] tabular-nums text-ink-soft">
                {strokeWidth} px
              </div>
              <button
                type="button"
                className="w-10 cursor-pointer rounded-lg border border-line bg-white text-base leading-none text-ink-soft hover:border-[#c4c1b8] hover:bg-[#faf9f6]"
                aria-label="Increase line width"
                onClick={() => adjustWidth(0.5)}
              >
                +
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className="m-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">COLOR</h3>
            <div className="flex items-stretch gap-1">
              <button
                type="button"
                className={COLOR_ARROW}
                aria-label="Previous colours"
                disabled={colorPage === 0}
                onClick={() => setColorPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="grid flex-1 grid-cols-6 gap-1.5">
                {colorSwatches.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`aspect-square w-full cursor-pointer rounded-full border-none p-0 transition-[transform,box-shadow] duration-100 hover:-translate-y-px ${
                      strokeColor === c ? 'shadow-[0_0_0_2px_#f5f3ef,0_0_0_4px_#76232f]' : ''
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Line colour ${c}`}
                    onClick={() => onDataChange({ strokeColor: c })}
                  />
                ))}
              </div>
              <button
                type="button"
                className={COLOR_ARROW}
                aria-label="More colours"
                disabled={colorPage === LAST_COLOR_PAGE}
                onClick={() => setColorPage((p) => Math.min(LAST_COLOR_PAGE, p + 1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.85rem] text-ink-soft">Custom</span>
              <ColorField value={strokeColor} label="Line" onChange={(hex) => onDataChange({ strokeColor: hex })} />
            </div>
          </section>

          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-white py-3 text-[0.88rem] text-mq-red transition-colors duration-[120ms] hover:border-mq-red hover:bg-[#fdf2f1]"
            onClick={onDelete}
          >
            <Trash2 size={15} />
            Delete connection
          </button>
        </div>
      </aside>

      {endpointEnd && (
        <div
          className="fixed z-[120] flex flex-col gap-0.5 overflow-y-auto rounded-lg border border-line bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
          role="listbox"
          aria-label="Endpoint markers"
          ref={menuRef}
          style={menuStyle}
        >
          <button
            type="button"
            role="option"
            aria-selected={currentMarker === 'none'}
            className={`-mx-1.5 flex cursor-pointer items-center justify-center gap-2.5 border-b border-[#eae7dd] bg-transparent px-2.5 py-2 text-[0.85rem] whitespace-nowrap text-ink-soft ${
              currentMarker === 'none' ? 'bg-[#f7e9ea]' : 'hover:bg-[#f3f1ea]'
            }`}
            onClick={() => pickMarker(endpointEnd, 'none')}
          >
            None
          </button>
          {enabledMarkers.map((m) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={m.id === currentMarker}
              className={`flex cursor-pointer items-center gap-2.5 rounded-md border-none bg-transparent px-2.5 py-[7px] text-left text-[0.85rem] whitespace-nowrap text-ink-soft ${
                m.id === currentMarker ? 'bg-[#f7e9ea]' : 'hover:bg-[#f3f1ea]'
              }`}
              title={m.label}
              aria-label={m.label}
              onClick={() => pickMarker(endpointEnd, m.id)}
            >
              <MarkerPreview kind={m.id} end={endpointEnd} width={64} />
            </button>
          ))}
          <button
            type="button"
            className="-mx-1.5 flex cursor-pointer items-center justify-center gap-2.5 border-t border-[#eae7dd] bg-transparent px-2.5 py-2 text-[0.85rem] whitespace-nowrap text-[#5f5e5a] hover:bg-[#f3f1ea]"
            onClick={openMore}
          >
            More
          </button>
        </div>
      )}

      {openMenu === 'line' && (
        <div
          className="fixed z-[120] flex flex-col gap-0.5 overflow-y-auto rounded-lg border border-line bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
          role="listbox"
          aria-label="Line styles"
          ref={menuRef}
          style={menuStyle}
        >
          {LINE_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={s.id === lineStyle}
              className={`flex cursor-pointer items-center gap-2.5 rounded-md border-none bg-transparent px-2.5 py-[7px] text-left text-[0.85rem] whitespace-nowrap text-ink-soft ${
                s.id === lineStyle ? 'bg-[#f7e9ea]' : 'hover:bg-[#f3f1ea]'
              }`}
              onClick={() => pickLineStyle(s.id)}
            >
              <LinePreview styleId={s.id} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {moreOpen && <LineEndingsDialog onClose={() => setMoreOpen(false)} />}
    </>
  );
}
