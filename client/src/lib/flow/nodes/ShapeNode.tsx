'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Handle,
  Position,
  NodeResizer,
  NodeResizeControl,
  ResizeControlVariant,
  useReactFlow,
  type NodeProps,
} from '@xyflow/react';
import { toFiniteRotation } from '@/lib/flow/nodes/style-utils';
import { VARIANTS, SHAPE_GEOMETRY, type Variant } from './shape-geometry';
import { useFontPreviewStore } from '@/lib/flow/font-preview-store';

// String → Position lookup so the VARIANTS config stays plain data.
const HANDLE_POSITION = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
} as const;

// Connection-handle classes. `shape-conn` is the DOM hook for the size/paint
// rule in xy-theme.css; the reveal is Tailwind, driven by the wrapper's
// `group` + `selected` classes.
const CONN_CLASS =
  'shape-conn pointer-events-none opacity-0 transition-opacity duration-[120ms] ' +
  'group-hover:pointer-events-auto group-hover:opacity-100 ' +
  'group-[.selected]:pointer-events-auto group-[.selected]:opacity-100';

// Handle placements in the shape data use CSS strings ("top: 1%; left: 59.5%");
// React needs style objects, so parse at the boundary (keeps the data faithful).
function cssStringToStyle(css?: string): CSSProperties | undefined {
  if (!css) return undefined;
  const style: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (!prop) continue;
    const key = prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[key] = value;
  }
  return style as CSSProperties;
}

export default function ShapeNode({ id, type, data, selected, isConnectable }: NodeProps) {
  const { updateNodeData } = useReactFlow();
  const d = (data ?? {}) as Record<string, unknown>;

  const variant: Variant = VARIANTS[type ?? ''] ?? { kind: 'svg' };
  // The variant's geometry alias when set, else the node's own type.
  const shapeType = variant.geometry ?? type ?? '';
  const geometry = SHAPE_GEOMETRY[shapeType] ?? null;
  const labelPlacement = variant.labelPlacement ?? (geometry?.kind === 'actor' ? 'below' : 'center');

  // Style fields populated by StylePanel. Defaults match the design ref.
  const fillColor = (d.fillColor as string) ?? '#ffffff';
  const strokeColor = (d.borderColor as string) ?? '#2c2c2a';
  const strokeWidth = (d.borderWidth as number) ?? 1.5;
  const rounded = (d.rounded as boolean) ?? false;
  const shadow = (d.shadow as boolean) ?? false;
  const opacityPct = Math.max(0, Math.min(100, Number(d.opacity ?? 100)));
  const visualOpacity = Number.isFinite(opacityPct) ? opacityPct / 100 : 1;
  const rotation = toFiniteRotation(d.rotation);
  // Counter-rotate the label so text stays upright regardless of node rotation.
  const labelTransform = rotation ? `rotate(${-rotation}deg)` : undefined;

  const textColor = (d.textColor as string) ?? '#2c2c2a';
  // Hovering a font / size option previews it live here, keyed by node id;
  // never touches data. Each field falls back to its committed value.
  const previewValue = useFontPreviewStore((s) => s.value);
  const preview = previewValue?.targetId === id ? previewValue : null;
  const fontFamily = preview?.fontFamily ?? ((d.fontFamily as string) ?? 'inherit');
  const fontSize = preview?.fontSize ?? ((d.fontSize as number) ?? 14);
  const bold = (d.bold as boolean) ?? false;
  const italic = (d.italic as boolean) ?? false;
  const underline = (d.underline as boolean) ?? false;
  const textAlign = (d.textAlign as string) ?? 'center';

  const labelStyle: CSSProperties = {
    color: textColor,
    fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: bold ? 700 : 400,
    fontStyle: italic ? 'italic' : 'normal',
    textDecoration: underline ? 'underline' : 'none',
    textAlign: textAlign as CSSProperties['textAlign'],
    lineHeight: 1.25,
  };

  // `rounded=false` only turns off the corner radius for plain Rectangle.
  const boxedRadius =
    shapeType === 'RectangleNode' && rounded === false ? '0' : variant.boxRadius ?? '0';

  const containerStyle: CSSProperties = {
    filter: shadow ? 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.18))' : 'none',
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center',
    transition: 'transform 120ms ease',
  };

  // ─── Label editing (double-click to type, like connection labels) ───
  const labelBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);

  function fitLabelTextarea() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function onInput(evt: React.ChangeEvent<HTMLTextAreaElement>) {
    updateNodeData(id, { label: evt.target.value });
    fitLabelTextarea();
  }

  function startEditing() {
    setEditing(true);
    // Wait for `readOnly` to clear so focus + select actually take.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
      fitLabelTextarea();
    });
  }

  function onLabelKeydown(evt: React.KeyboardEvent<HTMLTextAreaElement>) {
    evt.stopPropagation(); // keep keys out of xyflow's global shortcuts
    // Enter inserts a newline (default textarea behaviour) like draw.io. Escape
    // — or clicking away — finishes editing.
    if (evt.key === 'Escape') {
      evt.preventDefault();
      inputRef.current?.blur();
    }
  }

  function onLabelBlur() {
    setEditing(false);
    // Clear any lingering selection highlight after blur (see Svelte source).
    inputRef.current?.setSelectionRange(0, 0);
    window.getSelection()?.removeAllRanges();
  }

  // Deselection while editing == clicked away → end the edit.
  useEffect(() => {
    if (editing && !selected) inputRef.current?.blur();
  }, [editing, selected]);

  // Belt and braces: while editing, ANY pointerdown outside the input ends it.
  useEffect(() => {
    if (!editing) return;
    const onPointerDown = (e: PointerEvent) => {
      const input = inputRef.current;
      if (e.target instanceof Node && input && !input.contains(e.target)) {
        input.blur();
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [editing]);

  // Refit the textarea whenever the label text or type styling changes.
  useEffect(() => {
    requestAnimationFrame(fitLabelTextarea);
  }, [d.label, fontFamily, fontSize, bold, italic]);

  // Refit when the node box resizes.
  useEffect(() => {
    const el = labelBoxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => fitLabelTextarea());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const labelBoxClass =
    labelPlacement === 'below'
      ? 'absolute top-full left-1/2 mt-1 w-[max(100%,96px)] px-1 text-center [translate:-50%_0]'
      : labelPlacement === 'header'
        ? 'absolute top-[1%] left-0 flex h-[20%] w-full items-center px-3 py-1 text-center'
        : labelPlacement === 'top-left'
          ? 'absolute top-[3%] left-[3%] w-[94%] px-1 py-1 text-left'
          : labelPlacement === 'tab'
            ? 'absolute top-[1%] left-[1%] flex h-[17%] w-[27%] items-center px-2 py-0.5 text-left'
            : 'relative w-full px-3 py-2';

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`group relative flex h-full min-h-[30px] w-full items-center justify-center ${selected ? 'selected' : ''}`}
      style={containerStyle}
      onDoubleClick={(e) => {
        e.stopPropagation();
        startEditing();
      }}
    >
      {/* Paint the shape fill FIRST so handles + resize anchors render on top. */}
      {variant.kind === 'boxed' ? (
        <div
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible group-[.selected]:shadow-[0_0_0_2px_#a6192e]"
          style={{
            backgroundColor: fillColor,
            border: `${strokeWidth}px solid ${strokeColor}`,
            borderRadius: boxedRadius,
            opacity: visualOpacity,
          }}
        />
      ) : variant.kind === 'svg' ? (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible group-[.selected]:shadow-[0_0_0_2px_#a6192e]"
          style={{ opacity: visualOpacity }}
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          {geometry?.kind === 'ellipse' ? (
            <ellipse cx="50" cy="50" rx="49.5" ry="49.5" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
          ) : geometry?.kind === 'polygon' ? (
            <polygon points={geometry.points} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ) : geometry?.kind === 'polygons' ? (
            geometry.items.map((points) => (
              <polygon key={points} points={points} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            ))
          ) : geometry?.kind === 'path' ? (
            <path d={geometry.d} fillRule={geometry.fillRule} fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ) : geometry?.kind === 'paths' ? (
            geometry.items.map((item) => (
              <path key={item.d} d={item.d} fill={item.filled === false ? 'none' : fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeDasharray={item.dash} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            ))
          ) : geometry?.kind === 'bullseye' ? (
            <>
              <circle cx="50" cy="50" r="48" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
              <circle cx="50" cy="50" r="22" fill={strokeColor} />
            </>
          ) : geometry?.kind === 'actor' ? (
            <>
              <circle cx="50" cy="18" r="13" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
              <line x1="50" y1="31" x2="50" y2="68" stroke={strokeColor} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
              <line x1="22" y1="46" x2="78" y2="46" stroke={strokeColor} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
              <line x1="50" y1="68" x2="28" y2="98" stroke={strokeColor} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
              <line x1="50" y1="68" x2="72" y2="98" stroke={strokeColor} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
            </>
          ) : null}
        </svg>
      ) : null}

      {variant.resizeAnchors ? (
        selected
          ? variant.resizeAnchors.map((anchor) => (
              <NodeResizeControl
                key={anchor.position}
                position={anchor.position}
                variant={ResizeControlVariant.Handle}
                className="shape-resize-anchor"
                minWidth={60}
                minHeight={30}
              />
            ))
          : null
      ) : (
        <NodeResizer
          isVisible={selected}
          minWidth={variant.kind === 'text-only' ? 10 : 20}
          minHeight={variant.kind === 'text-only' ? 2 : 5}
          handleClassName="shape-resize-anchor"
          lineClassName="shape-resize-line"
        />
      )}

      {variant.handles ? (
        variant.handles.map((h) => (
          <Handle
            key={h.id}
            type="source"
            position={HANDLE_POSITION[h.position]}
            isConnectable={isConnectable}
            id={h.id}
            className={CONN_CLASS}
            style={cssStringToStyle(h.style)}
          />
        ))
      ) : (
        <>
          <Handle type="source" position={Position.Top} isConnectable={isConnectable} id="top" className={CONN_CLASS} />
          <Handle type="source" position={Position.Right} isConnectable={isConnectable} id="right" className={CONN_CLASS} />
          <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} id="bottom" className={CONN_CLASS} />
          <Handle type="source" position={Position.Left} isConnectable={isConnectable} id="left" className={CONN_CLASS} />
        </>
      )}

      <div
        ref={labelBoxRef}
        className={`pointer-events-auto select-none ${labelBoxClass}`}
        style={{ opacity: visualOpacity, transform: labelTransform }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={String(d.label ?? '')}
          onChange={onInput}
          readOnly={!editing}
          onKeyDown={onLabelKeydown}
          onBlur={onLabelBlur}
          onPointerDown={(e) => {
            if (editing) e.stopPropagation();
          }}
          spellCheck={false}
          aria-label="Node label"
          className={`nodrag m-0 block w-full resize-none appearance-none overflow-hidden border-none bg-transparent p-0 whitespace-pre-wrap outline-none break-words [overflow-wrap:anywhere] ${editing ? 'pointer-events-auto cursor-text select-text' : 'pointer-events-none cursor-[inherit]'}`}
          style={labelStyle}
        />
      </div>
    </div>
  );
}
