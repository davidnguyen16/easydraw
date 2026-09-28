'use client';

import type { ReactNode } from 'react';
import { ArrowUpRight, LoaderCircle, MoreHorizontal, Trash2 } from 'lucide-react';
import type { EditorState } from '@/lib/stores/editor-doc.store';

/**
 * The editable 3D samples that ship with the app. Their documents are built
 * on demand, client-side, from the starter object set; admins publish further
 * samples from the dashboard (see templates.ts).
 */
export interface SampleDefinition {
  id: 'data-centre' | 'office';
  heading: string;
  category: string;
  description: string;
  preview: ReactNode;
  load(): Promise<{ title: string; create(): EditorState }>;
}

export const SAMPLES: readonly SampleDefinition[] = [
  {
    id: 'data-centre',
    heading: 'Data centre in 3D',
    category: 'Data centre',
    description: 'Racks, spine switches, storage and cabling on a raised floor.',
    preview: <CampusPreview />,
    load: async () => {
      const { createDataCentreDocument, DATA_CENTRE_TITLE } = await import('@/lib/diagram3d/samples/data-centre');
      return { title: DATA_CENTRE_TITLE, create: createDataCentreDocument };
    },
  },
  {
    id: 'office',
    heading: 'Office floor in 3D',
    category: 'Office',
    description: 'Reception, meeting room, phone booths, open-plan desks and the lounge.',
    preview: <OfficePreview />,
    load: async () => {
      const { createOfficeDocument, OFFICE_TITLE } = await import('@/lib/diagram3d/samples/office');
      return { title: OFFICE_TITLE, create: createOfficeDocument };
    },
  },
];

/**
 * One tile in the "Sample diagrams" gallery: a built-in 3D sample (SVG
 * preview) or a published one (its 2D thumbnail). "Use sample" makes the
 * caller a fresh copy and opens it. Admins get a menu to unpublish.
 */
export function SampleCard({ title, category, description, preview, thumbnailUrl, badge, pending, error, onUse, menuOpen, onToggleMenu, onRemove }: {
  title: string;
  category: string | null;
  description?: string;
  preview?: ReactNode;
  thumbnailUrl?: string | null;
  badge?: string;
  pending: boolean;
  error: string;
  onUse: () => void;
  menuOpen?: boolean;
  onToggleMenu?: () => void;
  onRemove?: () => void;
}) {
  return (
    <section aria-label={`${title} sample`} className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line-soft bg-white shadow-sm transition hover:border-mq-red hover:shadow-md">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-line-soft bg-[#f3f7f4]">
        {badge && <span className="absolute top-3 left-3 z-10 rounded-full border border-[#ccded5] bg-white/85 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#477263] uppercase">{badge}</span>}
        {thumbnailUrl
          /* Thumbnails are private API images versioned by URL; Next image optimisation cannot fetch them. */
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={thumbnailUrl} alt="" loading="lazy" draggable={false} crossOrigin="use-credentials" className="size-full object-cover object-top" />
          : preview
            ? <div className="w-full max-w-[320px] px-3 pt-4">{preview}</div>
            : <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">No preview</span>}
      </div>
      <div className="flex flex-1 flex-col px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium text-ink" title={title}>{title}</p>
          {category && <span className="shrink-0 rounded-full bg-mq-pink px-2 py-0.5 text-[11px] font-medium text-mq-maroon">{category}</span>}
        </div>
        {description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted">{description}</p>}
        <button
          type="button"
          onClick={onUse}
          disabled={pending}
          aria-busy={pending}
          className="mt-3 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-mq-red bg-white px-3 py-1.5 text-sm font-semibold text-mq-maroon transition-colors enabled:hover:bg-mq-red enabled:hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mq-red disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowUpRight size={15} aria-hidden="true" />}
          {pending ? 'Creating…' : error ? 'Try again' : 'Use sample'}
        </button>
        {error && <p role="alert" className="mt-2 text-xs text-mq-red">{error}</p>}
      </div>
      {onRemove && onToggleMenu && <>
        <button
          onClick={onToggleMenu}
          aria-label="Sample actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-lg border border-line bg-white text-ink-muted shadow-sm transition-opacity hover:text-ink ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
        >
          <MoreHorizontal size={18} />
        </button>
        {menuOpen && <>
          <button className="fixed inset-0 z-10 cursor-default" onClick={onToggleMenu} aria-label="Close" tabIndex={-1} />
          <div role="menu" className="absolute top-11 right-2 z-20 w-44 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg">
            <button role="menuitem" onClick={onRemove} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-mq-red hover:bg-mq-pink">
              <Trash2 size={16} /> Remove sample
            </button>
          </div>
        </>}
      </>}
    </section>
  );
}

function PreviewRack({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <polygon points="0,3 19,13 33,5 14,-5" fill="#0e222c" opacity="0.12" transform="translate(4 51)" />
    <polygon points="0,0 19,10 19,64 0,54" fill="#30434d" />
    <polygon points="19,10 33,2 33,56 19,64" fill="#20313b" />
    <polygon points="0,0 14,-8 33,2 19,10" fill="#536b75" />
    {[12, 22, 32, 42].map((row) => <g key={row}>
      <path d={`M3 ${row}l13 7v6l-13-7z`} fill="#172d37" />
      <path d={`M5 ${row + 3}l6 3`} stroke="#7c969d" strokeWidth="1.2" />
      <circle cx="14" cy={row + 8} r="1.15" fill="#73ead3" />
    </g>)}
    <path d="M23 18l6-3m-6 8 6-3m-6 8 6-3m-6 8 6-3m-6 8 6-3m-6 8 6-3" stroke="#4b6975" strokeWidth="1.3" />
  </g>;
}

/** Original SVG artwork: no image download or 3D renderer is needed on the dashboard. */
function CampusPreview() {
  return <svg viewBox="0 0 480 300" className="h-full w-full" aria-hidden="true" focusable="false">
    <ellipse cx="247" cy="255" rx="181" ry="22" fill="#dae5e4" opacity="0.55" />
    <polygon points="33,163 231,56 450,164 252,273" fill="#c9d9d7" />
    <polygon points="33,163 252,273 252,282 33,172" fill="#bacdca" />
    <polygon points="252,273 450,164 450,173 252,282" fill="#a8bfbd" />
    <polygon points="50,162 231,65 432,164 252,262" fill="#edf3f0" />
    <path d="M89 181 270 84m-141 117 181-97m-141 117 181-97m-141 117 181-97M89 141l201 100M129 120l201 100M169 98l201 100M209 77l201 100"
      stroke="#d7e2dd" strokeWidth="1" />
    <path d="M69 164l177 88 166-88-56-28" fill="none" stroke="#67bdad" strokeWidth="2" strokeDasharray="4 4" />
    <path d="m294 203 47-26 38 18m-113-8 35-19" fill="none" stroke="#159c99" strokeWidth="3" strokeLinejoin="round" />
    <g>
      <polygon points="315,115 359,138 359,164 315,142" fill="#c8dad9" />
      <polygon points="359,138 383,125 383,151 359,164" fill="#adc6c6" />
      <polygon points="315,115 339,102 383,125 359,138" fill="#e7f0eb" />
      <path d="m322 126 29 15m-29-10 29 15m-29-10 29 15" stroke="#88a8ad" strokeWidth="2" />
      <ellipse cx="339" cy="119" rx="8" ry="4" fill="#92aaa9" />
      <ellipse cx="361" cy="130" rx="8" ry="4" fill="#92aaa9" />
    </g>
    <PreviewRack x={179} y={78} />
    <PreviewRack x={220} y={99} />
    <PreviewRack x={261} y={120} />
    <PreviewRack x={129} y={105} />
    <PreviewRack x={170} y={126} />
    <PreviewRack x={211} y={147} />
    <g>
      <polygon points="306,195 342,213 366,200 330,182" fill="#49b9ab" />
      <polygon points="306,195 342,213 342,223 306,205" fill="#27897f" />
      <polygon points="342,213 366,200 366,210 342,223" fill="#206f6b" />
      <path d="m313 201 4 2m3 2 4 2m3 1 4 2" stroke="#b6f3dc" strokeWidth="2" />
      <circle cx="356" cy="170" r="4" fill="#d6a353" />
      <circle cx="378" cy="183" r="3" fill="#d6a353" />
    </g>
    <path d="m78 161 20 10m-13-19 20 10" stroke="#adc6bd" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

/** An isometric desk with a monitor and a chair in front, drawn with the campus preview's projection. */
function PreviewDesk({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}>
    <polygon points="0,4 30,20 30,24 0,8" fill="#0e222c" opacity="0.1" transform="translate(6 30)" />
    <polygon points="0,0 34,18 58,5 24,-13" fill="#d9b58f" />
    <polygon points="0,0 34,18 34,23 0,5" fill="#b8956f" />
    <polygon points="34,18 58,5 58,10 34,23" fill="#a3825f" />
    <path d="M3 5v16m31 4v16m24-31v16" stroke="#8d7156" strokeWidth="2" />
    <polygon points="26,-9 40,-2 40,10 26,3" fill="#1f2d3a" />
    <polygon points="27,-7 39,-1 39,8 27,2" fill="#3f8fbd" />
    <path d="M33 4v6" stroke="#1f2d3a" strokeWidth="2" />
    <polygon points="14,4 26,10 26,12 14,6" fill="#e6edf0" />
    <g transform="translate(10 28)">
      <polygon points="0,0 14,7 24,2 10,-5" fill="#38485a" />
      <polygon points="10,-16 24,-9 24,2 10,-5" fill="#2d3b4a" />
      <path d="M12 7v9" stroke="#8d97a1" strokeWidth="2" />
      <ellipse cx="12" cy="17" rx="7" ry="3" fill="#2d3b4a" />
    </g>
  </g>;
}

function OfficePreview() {
  return <svg viewBox="0 0 480 300" className="h-full w-full" aria-hidden="true" focusable="false">
    <ellipse cx="247" cy="255" rx="181" ry="22" fill="#e6e1d8" opacity="0.6" />
    <polygon points="33,163 231,56 450,164 252,273" fill="#d7d1c4" />
    <polygon points="33,163 252,273 252,282 33,172" fill="#c4bdae" />
    <polygon points="252,273 450,164 450,173 252,282" fill="#b1aa9a" />
    <polygon points="50,162 231,65 432,164 252,262" fill="#f6f3ec" />
    <path d="M89 181 270 84m-141 117 181-97m-141 117 181-97M89 141l201 100M129 120l201 100M169 98l201 100M209 77l201 100"
      stroke="#e6e1d6" strokeWidth="1" />
    {/* Glass meeting room at the back with a long table. */}
    <g>
      <polygon points="300,108 372,146 372,176 300,138" fill="#cfe0ea" opacity="0.75" />
      <polygon points="372,146 412,124 412,154 372,176" fill="#bfd3e0" opacity="0.75" />
      <path d="M300 108v30m72 8v30m40-52v30" stroke="#8fa9b8" strokeWidth="1.5" />
      <polygon points="318,140 352,158 378,144 344,126" fill="#d9b58f" />
      <polygon points="318,140 352,158 352,162 318,144" fill="#b8956f" />
      <polygon points="352,158 378,144 378,148 352,162" fill="#a3825f" />
      {[[314, 150], [334, 160], [352, 171], [332, 126], [352, 136], [372, 146]].map(([cx, cy]) => <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="5" ry="2.6" fill="#38485a" />)}
      <polygon points="382,110 400,119 400,131 382,122" fill="#1f2d3a" />
      <polygon points="383,112 399,120 399,129 383,121" fill="#47dab8" />
    </g>
    <PreviewDesk x={120} y={112} />
    <PreviewDesk x={162} y={133} />
    <PreviewDesk x={204} y={154} />
    <PreviewDesk x={170} y={86} />
    <PreviewDesk x={212} y={107} />
    <PreviewDesk x={254} y={128} />
    {/* Lounge: sofa, plant, person. */}
    <g>
      <polygon points="300,205 336,223 356,212 320,194" fill="#5c7f9a" />
      <polygon points="300,205 336,223 336,232 300,214" fill="#4a6a83" />
      <polygon points="336,223 356,212 356,221 336,232" fill="#3f5b71" />
      <polygon points="300,197 320,186 336,194 316,205" fill="#7a9bb6" />
      <rect x="373" y="168" width="10" height="18" fill="#bd9871" />
      <circle cx="378" cy="160" r="12" fill="#68a26b" />
      <circle cx="371" cy="166" r="8" fill="#2e7153" />
      <circle cx="386" cy="167" r="8" fill="#2e7153" />
      <rect x="86" y="188" width="10" height="20" rx="4" fill="#3f91be" />
      <circle cx="91" cy="183" r="5" fill="#e0b48a" />
    </g>
    <path d="m78 161 20 10m-13-19 20 10" stroke="#c7bfaf" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
