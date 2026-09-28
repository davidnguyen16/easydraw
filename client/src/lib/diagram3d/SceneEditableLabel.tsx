'use client';

import { useState, type CSSProperties, type MouseEvent } from 'react';

export function sceneLabelStyle(data: Record<string, unknown>, defaultSize = 12): CSSProperties {
  return {
    fontFamily: typeof data.fontFamily === 'string' ? data.fontFamily : undefined,
    fontSize: typeof data.fontSize === 'number' && Number.isFinite(data.fontSize) ? Math.max(6, Math.min(144, data.fontSize)) : defaultSize,
    fontWeight: data.bold === true ? 700 : 400,
    fontStyle: data.italic === true ? 'italic' : 'normal',
    textDecoration: data.underline === true ? 'underline' : 'none',
    textAlign: data.textAlign === 'left' || data.textAlign === 'right' ? data.textAlign : 'center',
    color: typeof data.textColor === 'string' ? data.textColor : undefined,
  };
}

/** DOM labels remain legible at every camera angle and use the same persisted
 * text as the 2D editor. An input owns its keyboard events while editing. */
export function SceneEditableLabel({ text, editing, selected, kind, id, onSelect, onCommit, style, onContextMenu, geometry }: {
  text: string;
  editing: boolean;
  selected: boolean;
  kind: 'node' | 'edge';
  id: string;
  onSelect: (additive: boolean) => void;
  onCommit: (text: string) => void;
  style?: CSSProperties;
  onContextMenu?: (event: MouseEvent) => void;
  geometry?: { position: number[]; size: number[]; rotation: number[] };
}) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (draft === null) return;
    if (draft !== text) onCommit(draft);
    setDraft(null);
  }
  if (draft !== null && editing) {
    return (
      <input
        autoFocus
        aria-label={kind === 'node' ? 'Edit object label' : 'Edit connection label'}
        value={draft}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') { event.preventDefault(); commit(); }
          if (event.key === 'Escape') { event.preventDefault(); setDraft(null); }
        }}
        className="w-44 rounded border border-[#a6192e] bg-white px-2 py-1 text-xs text-[#423c35] shadow-sm outline-none"
      />
    );
  }
  return (
    <button
      type="button"
      data-node-id={kind === 'node' ? id : undefined}
      data-edge-id={kind === 'edge' ? id : undefined}
      data-node-position={geometry ? JSON.stringify(geometry.position) : undefined}
      data-node-size={geometry ? JSON.stringify(geometry.size) : undefined}
      data-node-rotation={geometry ? JSON.stringify(geometry.rotation) : undefined}
      title={`${text || 'Untitled'}${editing ? ' — double-click to edit' : ''}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); onSelect(event.shiftKey || event.metaKey || event.ctrlKey); }}
      onDoubleClick={(event) => { event.stopPropagation(); if (editing) setDraft(text); }}
      onContextMenu={onContextMenu}
      className={`block max-w-64 cursor-pointer whitespace-pre-wrap break-words rounded border px-2 py-1 text-xs shadow-sm ${selected ? 'border-[#a6192e] ring-1 ring-[#a6192e]/20' : 'border-[#e1d9cd]'} ${kind === 'node' ? 'font-semibold' : 'font-normal'}`}
      style={{ backgroundColor: '#fffdf8', color: '#625748', ...style }}
    >
      {text || (kind === 'node' ? 'Untitled object' : 'Add label')}
    </button>
  );
}
