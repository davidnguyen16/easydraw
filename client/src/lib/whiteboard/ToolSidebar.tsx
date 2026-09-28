'use client';

import {
  Brush,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eraser,
  Hand,
  Lasso,
  Minus,
  PaintBucket,
  Pencil,
  Pentagon,
  Pipette,
  SprayCan,
  Square,
  SquareDashed,
  Squircle,
  Spline,
  Type,
  type LucideIcon,
} from 'lucide-react';
import type { ToolId } from './engine/types';
import { useWhiteboard } from './whiteboard.store';
import PanelResizeHandle from './PanelResizeHandle';
import { TOOLS_MIN_WIDTH } from './panel-layout';

export interface ToolMeta {
  id: ToolId;
  label: string;
  /** Shorter name for the palette tile when the full one does not fit. */
  short?: string;
  /** Single-key shortcut, as PaintZ assigns them. */
  key?: string;
  icon: LucideIcon;
}

export const TOOL_GROUPS: { label: string; tools: ToolMeta[] }[] = [
  {
    label: 'Select',
    tools: [
      { id: 'selection', label: 'Selection', key: 'S', icon: SquareDashed },
      { id: 'freeform-selection', label: 'Freeform selection', short: 'Freeform', key: 'F', icon: Lasso },
      { id: 'pan', label: 'Pan', key: 'H', icon: Hand },
    ],
  },
  {
    label: 'Draw',
    tools: [
      { id: 'pencil', label: 'Pencil', key: 'P', icon: Pencil },
      { id: 'brush', label: 'Brush', key: 'B', icon: Brush },
      { id: 'airbrush', label: 'Airbrush', icon: SprayCan },
      { id: 'eraser', label: 'Eraser', key: 'E', icon: Eraser },
      { id: 'flood-fill', label: 'Flood fill', key: 'K', icon: PaintBucket },
      { id: 'eyedropper', label: 'Color picker', short: 'Picker', key: 'I', icon: Pipette },
    ],
  },
  {
    label: 'Shapes',
    tools: [
      { id: 'line', label: 'Line', key: 'L', icon: Minus },
      { id: 'curve', label: 'Curve', key: 'C', icon: Spline },
      { id: 'rectangle', label: 'Rectangle', key: 'R', icon: Square },
      { id: 'rounded-rectangle', label: 'Rounded rectangle', short: 'Rounded', icon: Squircle },
      { id: 'oval', label: 'Oval', key: 'O', icon: Circle },
      { id: 'polygon', label: 'Polygon', icon: Pentagon },
    ],
  },
  {
    label: 'Text',
    tools: [{ id: 'text', label: 'Text', key: 'T', icon: Type }],
  },
];

export const TOOLS: ToolMeta[] = TOOL_GROUPS.flatMap((g) => g.tools);

/** Left palette of tools, laid out like the diagram editor's shape sidebar. */
export default function ToolSidebar({ width, maxWidth, collapsed, onResize, onResizeEnd, onToggle }: {
  width: number;
  maxWidth: number;
  collapsed: boolean;
  onResize: (width: number) => void;
  onResizeEnd: () => void;
  onToggle: () => void;
}) {
  const engine = useWhiteboard((s) => s.engine);
  const active = useWhiteboard((s) => s.tool);
  return (
    <aside id="whiteboard-tools-panel" style={{ width }} className="relative min-h-0 shrink-0 border-r border-line-soft bg-panel" aria-label="Tools">
      <button type="button" aria-label={collapsed ? 'Expand tools sidebar' : 'Collapse tools sidebar'}
        aria-expanded={!collapsed} aria-controls="whiteboard-tools-content" title={collapsed ? 'Expand tools sidebar' : 'Collapse tools sidebar'}
        onClick={onToggle} onKeyDown={(event) => event.stopPropagation()}
        className="absolute right-1 top-2 z-50 flex size-6 cursor-pointer items-center justify-center rounded-full border border-line bg-white text-ink-soft shadow-sm hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-mq-red">
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
      <div id="whiteboard-tools-content" hidden={collapsed} inert={collapsed}
        className={`${collapsed ? 'hidden' : 'flex'} h-full flex-col gap-6 overflow-x-hidden overflow-y-auto px-3 pb-4 pt-10`}>
      {TOOL_GROUPS.map((group) => (
        <section key={group.label}>
          <h2 className="mb-2 px-1 text-[0.72rem] font-bold tracking-[0.12em] text-mq-maroon uppercase">{group.label}</h2>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))' }} role="radiogroup" aria-label={group.label}>
            {group.tools.map((tool) => {
              const Icon = tool.icon;
              const selected = tool.id === active;
              return (
                <button
                  key={tool.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  title={tool.key ? `${tool.label} (${tool.key})` : tool.label}
                  onClick={() => engine?.setTool(tool.id)}
                  className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border text-[0.66rem] leading-tight transition-colors ${
                    selected
                      ? 'border-mq-red bg-mq-pink text-mq-red'
                      : 'border-line-soft bg-white text-ink-soft hover:border-line hover:bg-surface-hover'
                  }`}
                >
                  <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
                  <span className="max-w-full truncate px-1">{tool.short ?? tool.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      </div>
      {!collapsed && <PanelResizeHandle edge="right" label="Resize tools sidebar" controls="whiteboard-tools-panel"
        width={width} minWidth={TOOLS_MIN_WIDTH} maxWidth={maxWidth} onResize={onResize} onResizeEnd={onResizeEnd} />}
    </aside>
  );
}
