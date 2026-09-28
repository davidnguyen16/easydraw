'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { useAssetUrl } from '@/lib/node-library/assets';
import { useEditorStore } from '@/lib/stores/editor.store';
import { useFontPreviewStore } from '@/lib/flow/font-preview-store';
import { toFiniteRotation } from '../style-utils';

const CONNECTION_CLASS = 'shape-conn pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-[.selected]:pointer-events-auto group-[.selected]:opacity-100';

/** Generic renderer: uploaded file IDs, not image URLs or React components, are persisted. */
export default function CustomImageNode({ id, data, selected, isConnectable }: NodeProps) {
  const { updateNodeData } = useReactFlow();
  const locked = useEditorStore((state) => state.locked || state.presenting);
  const previewValue = useFontPreviewStore((state) => state.value);
  const preview = previewValue?.targetId === id ? previewValue : null;
  const assetId = typeof data.assetId === 'string' ? data.assetId : undefined;
  const image = useAssetUrl(assetId);
  const input = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const label = typeof data.label === 'string' ? data.label : '';
  const rotation = toFiniteRotation(data.rotation);
  const rawOpacity = Number(data.opacity ?? 100);
  const opacity = Number.isFinite(rawOpacity) ? Math.max(0, Math.min(100, rawOpacity)) / 100 : 1;
  const error = image.error || (decodeError === image.url ? 'The custom image could not be decoded.' : undefined);
  const status = error ? 'error' : image.url ? 'ready' : 'loading';

  useEffect(() => {
    if ((!selected || locked) && editing) input.current?.blur();
  }, [selected, locked, editing]);

  useEffect(() => {
    const element = input.current;
    if (!element) return;
    const fit = () => { element.style.height = 'auto'; element.style.height = `${element.scrollHeight}px`; };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [label, data.fontSize, data.fontFamily, preview?.fontFamily, preview?.fontSize]);

  const labelStyle: CSSProperties = {
    color: typeof data.textColor === 'string' ? data.textColor : '#2c2c2a',
    fontFamily: preview?.fontFamily ?? (typeof data.fontFamily === 'string' ? data.fontFamily : 'inherit'),
    fontSize: preview?.fontSize ?? (typeof data.fontSize === 'number' ? data.fontSize : 14),
    fontWeight: data.bold ? 700 : 400,
    fontStyle: data.italic ? 'italic' : 'normal',
    textDecoration: data.underline ? 'underline' : 'none',
    textAlign: data.textAlign === 'left' || data.textAlign === 'right' ? data.textAlign : 'center',
    lineHeight: 1.25,
    opacity,
  };

  return (
    <div
      className={`group relative h-full min-h-5 w-full ${selected ? 'selected' : ''}`}
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }}
      data-custom-image-state={status}
      data-custom-image-error={error}
      data-asset-id={assetId}
      onDoubleClick={(event) => {
        if (locked) return;
        event.stopPropagation();
        setEditing(true);
        requestAnimationFrame(() => { input.current?.focus(); input.current?.select(); });
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden group-[.selected]:outline group-[.selected]:outline-2 group-[.selected]:outline-mq-red" style={{
        opacity,
        background: typeof data.fillColor === 'string' ? data.fillColor : 'transparent',
        border: Number(data.borderWidth) > 0 ? `${Number(data.borderWidth)}px solid ${typeof data.borderColor === 'string' ? data.borderColor : '#2c2c2a'}` : undefined,
        borderRadius: data.rounded ? 8 : undefined,
        filter: data.shadow ? 'drop-shadow(0 4px 8px rgba(0,0,0,.18))' : undefined,
      }}>
        {/* Authenticated assets use temporary local blob URLs, not the Next image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image.url && !error ? <img src={image.url} alt={label} draggable={false} className="h-full w-full object-contain" onError={() => setDecodeError(image.url ?? null)} /> : <div className="flex h-full w-full items-center justify-center border border-dashed border-line bg-[#f6f5f1] p-2 text-center text-[11px] text-ink-muted" role={error ? 'alert' : 'status'} title={error}>{error ? 'Image unavailable' : 'Loading image…'}</div>}
      </div>
      <NodeResizer isVisible={Boolean(selected && !locked)} minWidth={20} minHeight={20} handleClassName="shape-resize-anchor" lineClassName="shape-resize-line" />
      {([['top', Position.Top], ['right', Position.Right], ['bottom', Position.Bottom], ['left', Position.Left]] as const).map(([handleId, position]) => <Handle key={handleId} id={handleId} type="source" position={position} isConnectable={isConnectable && !locked} className={CONNECTION_CLASS} />)}
      <div className="absolute top-full left-1/2 mt-1 w-[max(100%,96px)] px-1 [translate:-50%_0]" style={{ transform: rotation ? `rotate(${-rotation}deg)` : undefined }}>
        <textarea
          ref={input}
          rows={1}
          value={label}
          readOnly={!editing || locked}
          spellCheck={false}
          aria-label="Custom node label"
          className={`nodrag block w-full resize-none appearance-none overflow-hidden border-none bg-transparent p-0 outline-none ${editing ? 'pointer-events-auto cursor-text' : 'pointer-events-none'}`}
          style={labelStyle}
          onChange={(event) => updateNodeData(id, { label: event.target.value })}
          onPointerDown={(event) => { if (editing) event.stopPropagation(); }}
          onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); input.current?.blur(); } }}
          onBlur={() => setEditing(false)}
        />
      </div>
    </div>
  );
}
