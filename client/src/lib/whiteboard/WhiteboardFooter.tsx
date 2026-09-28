'use client';

import { Grid3x3, Keyboard } from 'lucide-react';
import { useWhiteboard } from './whiteboard.store';
import { TOOLS } from './ToolSidebar';

/** Status strip: board size, pointer position, zoom, grid — like the diagram footer. */
export default function WhiteboardFooter({ onShortcuts }: { onShortcuts: () => void }) {
  const size = useWhiteboard((s) => s.size);
  const pointer = useWhiteboard((s) => s.pointer);
  const zoom = useWhiteboard((s) => s.zoom);
  const showGrid = useWhiteboard((s) => s.showGrid);
  const toggleGrid = useWhiteboard((s) => s.toggleGrid);
  const tool = useWhiteboard((s) => s.tool);
  const toolLabel = TOOLS.find((t) => t.id === tool)?.label ?? '';

  return (
    <footer className="flex h-9 flex-shrink-0 items-center justify-between border-t border-[#E0E0E0] bg-[#FAFAFA] px-3 text-[0.78rem] text-[#5a5c58] select-none">
      <div className="flex items-center gap-4 tabular-nums">
        <span title="Canvas size">{size.width} × {size.height} px</span>
        <span title="Pointer coordinates" className="min-w-[88px]">{pointer ? `${pointer.x}, ${pointer.y}` : ''}</span>
        <span className="text-ink-muted">{toolLabel}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleGrid}
          aria-pressed={showGrid}
          title="Show gridlines at 400% and above (Ctrl+G)"
          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-[#F0F0F0] ${showGrid ? 'text-mq-red' : ''}`}
        >
          <Grid3x3 size={14} aria-hidden="true" />
          Grid
        </button>
        <button type="button" onClick={onShortcuts} title="Keyboard shortcuts (?)" className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-[#F0F0F0]">
          <Keyboard size={14} aria-hidden="true" />
          Shortcuts
        </button>
        <span className="ml-2 tabular-nums">{Math.round(zoom * 100)}%</span>
      </div>
    </footer>
  );
}
