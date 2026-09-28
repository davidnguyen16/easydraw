'use client';

import { MousePointer2, Move3D, Rotate3D, Scaling, Cable, Orbit } from 'lucide-react';
import { useEditorStore } from '@/lib/stores/editor.store';

const TOOLS = [
  ['select', 'Select', MousePointer2], ['move', 'Move', Move3D],
  ['rotate', 'Rotate', Rotate3D], ['scale', 'Resize', Scaling],
  ['connect', 'Connect', Cable], ['orbit', 'Orbit', Orbit],
] as const;

export default function Diagram3DToolbar() {
  const tool = useEditorStore((state) => state.tool3d);
  const setTool = useEditorStore((state) => state.setTool3d);
  const locked = useEditorStore((state) => state.locked);
  return <div className="flex min-h-10 flex-wrap items-center gap-1 border-b border-line bg-white px-3 py-1" role="toolbar" aria-label="3D editing tools">
    {TOOLS.map(([id, label, Icon]) => <button key={id} type="button" aria-label={label} aria-pressed={tool === id}
      disabled={locked && id !== 'orbit'} onClick={() => setTool(id)}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs disabled:opacity-40 ${tool === id ? 'bg-mq-pink text-mq-maroon' : 'text-ink-soft hover:bg-surface-hover'}`}>
      <Icon size={15} />{label}
    </button>)}
    <span className="ml-3 text-xs text-ink-muted">Drag to move · Shift-click to select more · Double-click a label to edit · Orbit on empty space</span>
  </div>;
}
