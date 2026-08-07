'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { toFiniteRotation } from '../style-utils';
import { getNetworkDefinition } from './definitions';
import NetworkGlyph from './NetworkGlyph';
import { useFontPreviewStore } from '@/lib/flow/font-preview-store';

const CONNECTION_HANDLE_CLASS =
  'network-conn pointer-events-none opacity-0 transition-opacity duration-[120ms] ' +
  'group-hover:pointer-events-auto group-hover:opacity-100 ' +
  'group-[.selected]:pointer-events-auto group-[.selected]:opacity-100';

export default function NetworkNode({ id, type, data, selected, isConnectable }: NodeProps) {
  const { updateNodeData } = useReactFlow();
  const d = (data ?? {}) as Record<string, unknown>;

  const definition = getNetworkDefinition(type);
  const isContainer = definition?.kind === 'container';
  const handleBounds = definition?.handleBounds ?? { top: 0, right: 100, bottom: 100, left: 0 };

  const fillColor = (d.fillColor as string) ?? '#ffffff';
  const borderColor = (d.borderColor as string) ?? '#2c2c2a';
  const borderWidth = Number(d.borderWidth ?? 1.5);
  const accentColor = (d.accentColor as string) ?? '#a6192e';
  const shadow = (d.shadow as boolean) ?? false;
  const opacityPct = Math.max(0, Math.min(100, Number(d.opacity ?? 100)));
  const visualOpacity = Number.isFinite(opacityPct) ? opacityPct / 100 : 1;
  const rotation = toFiniteRotation(d.rotation);
  const strokeScale = Number.isFinite(borderWidth)
    ? Math.max(0, Math.min(10 / 1.8, borderWidth / 1.8))
    : 1;

  const textColor = (d.textColor as string) ?? '#2c2c2a';
  // Live font/size preview (toolbar / Text-tab hover), keyed by node id; never
  // touches data — each field falls back to its committed value.
  const previewValue = useFontPreviewStore((s) => s.value);
  const preview = previewValue?.targetId === id ? previewValue : null;
  const fontFamily = preview?.fontFamily ?? ((d.fontFamily as string) ?? 'inherit');
  const fontSize = preview?.fontSize ?? ((d.fontSize as number) ?? 13);
  const bold = (d.bold as boolean) ?? false;
  const italic = (d.italic as boolean) ?? false;
  const underline = (d.underline as boolean) ?? false;
  const textAlign = (d.textAlign as string) ?? (isContainer ? 'left' : 'center');
  const labelTransform = rotation ? `rotate(${-rotation}deg)` : undefined;

  const labelStyle: CSSProperties = {
    color: textColor,
    fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: bold ? 700 : isContainer ? 600 : 500,
    fontStyle: italic ? 'italic' : 'normal',
    textDecoration: underline ? 'underline' : 'none',
    textAlign: textAlign as CSSProperties['textAlign'],
    lineHeight: 1.25,
  };

  const containerStyle: CSSProperties = {
    filter: shadow ? 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.18))' : 'none',
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center',
    transition: 'transform 120ms ease',
  };

  const labelBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);

  function fitLabelTextarea() {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }

  function startEditing() {
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
      fitLabelTextarea();
    });
  }

  function onInput(event: React.ChangeEvent<HTMLTextAreaElement>) {
    updateNodeData(id, { label: event.target.value });
    fitLabelTextarea();
  }

  function onLabelKeydown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    event.stopPropagation();
    // Enter inserts a newline (default textarea behaviour) like draw.io. Escape
    // — or clicking away — finishes editing.
    if (event.key === 'Escape') {
      event.preventDefault();
      inputRef.current?.blur();
    }
  }

  function onLabelBlur() {
    setEditing(false);
    inputRef.current?.setSelectionRange(0, 0);
    window.getSelection()?.removeAllRanges();
  }

  useEffect(() => {
    if (editing && !selected) inputRef.current?.blur();
  }, [editing, selected]);

  useEffect(() => {
    if (!editing) return;
    const onPointerDown = (event: PointerEvent) => {
      const input = inputRef.current;
      if (event.target instanceof Node && input && !input.contains(event.target)) {
        input.blur();
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [editing]);

  useEffect(() => {
    requestAnimationFrame(fitLabelTextarea);
  }, [d.label, fontFamily, fontSize, bold, italic]);

  useEffect(() => {
    const element = labelBoxRef.current;
    if (!element) return;
    const observer = new ResizeObserver(fitLabelTextarea);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`group relative flex h-full w-full items-center justify-center ${selected ? 'selected' : ''} ${isContainer ? 'network-container' : ''}`}
      style={containerStyle}
      onDoubleClick={(event) => {
        event.stopPropagation();
        startEditing();
      }}
    >
      {definition ? (
        <NetworkGlyph
          id={definition.id}
          mode="canvas"
          fillColor={fillColor}
          strokeColor={borderColor}
          accentColor={accentColor}
          strokeScale={strokeScale}
          opacity={visualOpacity}
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible transition-[filter] group-[.selected]:drop-shadow-[0_0_2px_#a6192e]"
        />
      ) : null}

      <NodeResizer
        isVisible={selected}
        minWidth={definition?.minWidth ?? 56}
        minHeight={definition?.minHeight ?? 44}
        keepAspectRatio={definition?.keepAspectRatio ?? true}
        handleClassName="network-resize-anchor"
        lineClassName="network-resize-line"
      />

      {!isContainer ? (
        <>
          <Handle
            type="source"
            position={Position.Top}
            isConnectable={isConnectable}
            id="top"
            className={CONNECTION_HANDLE_CLASS}
            style={{ top: `${handleBounds.top}%` }}
          />
          <Handle
            type="source"
            position={Position.Right}
            isConnectable={isConnectable}
            id="right"
            className={CONNECTION_HANDLE_CLASS}
            style={{ right: `${100 - handleBounds.right}%` }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            isConnectable={isConnectable}
            id="bottom"
            className={CONNECTION_HANDLE_CLASS}
            style={{ bottom: `${100 - handleBounds.bottom}%` }}
          />
          <Handle
            type="source"
            position={Position.Left}
            isConnectable={isConnectable}
            id="left"
            className={CONNECTION_HANDLE_CLASS}
            style={{ left: `${handleBounds.left}%` }}
          />
        </>
      ) : null}

      <div
        ref={labelBoxRef}
        className={`pointer-events-auto select-none ${
          isContainer
            ? 'absolute top-0 left-0 flex h-[18.75%] w-full items-center px-4 py-1'
            : 'absolute top-full left-1/2 mt-1 w-[max(100%,140px)] px-1 text-center [translate:-50%_0]'
        }`}
        style={{ opacity: visualOpacity, transform: labelTransform }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={String(d.label ?? definition?.label ?? '')}
          onChange={onInput}
          readOnly={!editing}
          onKeyDown={onLabelKeydown}
          onBlur={onLabelBlur}
          onPointerDown={(event) => {
            if (editing) event.stopPropagation();
          }}
          spellCheck={false}
          aria-label="Network node label"
          className={`nodrag m-0 block w-full resize-none appearance-none overflow-hidden border-none bg-transparent p-0 whitespace-pre-wrap outline-none break-words [overflow-wrap:anywhere] ${editing ? 'pointer-events-auto cursor-text select-text' : 'pointer-events-none cursor-[inherit]'}`}
          style={labelStyle}
        />
      </div>
    </div>
  );
}
