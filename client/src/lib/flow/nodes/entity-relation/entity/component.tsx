'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Handle, Position, NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react';
import { toFiniteRotation } from '@/lib/flow/nodes/style-utils';
import { useFontPreviewStore } from '@/lib/flow/font-preview-store';
import { resolveFieldKey, type EntityData } from './types';

// Per-key badge colours — mirrors the FieldsPanel palette 1:1.
const BADGE_CLASS: Record<string, string> = {
  PK: 'bg-[#fae9c8] text-[#854f0b]',
  FK: 'bg-[#dce9fa] text-[#1e4380]',
  PI: 'bg-[#c8eae0] text-[#0b6354]',
  WPI: 'bg-[#e3d8fa] text-[#5a3fb0]',
};

export default function EntityNode({ id, data, selected }: NodeProps) {
  const entity = data as unknown as EntityData;
  const { updateNodeData } = useReactFlow();

  function commit(patch: Partial<EntityData>) {
    if (entity.onEdit) entity.onEdit(patch);
    else updateNodeData(id, patch);
  }

  function setLabel(value: string) {
    commit({ label: value });
  }

  function setFieldName(index: number, value: string) {
    commit({
      fields: entity.fields.map((field, i) => (i === index ? { ...field, name: value } : field)),
    });
  }

  // Style overrides from StylePanel. Anything left undefined keeps the
  // entity's built-in defaults. fillColor is scoped to the header only.
  const opacityPct = Math.max(0, Math.min(100, Number(entity.opacity ?? 100)));
  const visualOpacity = Number.isFinite(opacityPct) ? opacityPct / 100 : 1;
  const borderColor = entity.borderColor ?? '#373a36';
  const borderWidth = entity.borderWidth ?? 1;
  const cardRadius = entity.rounded === false ? '0' : '4px';
  const rotation = toFiniteRotation(entity.rotation);

  // Rotation lives on the ROOT div so the selection ring, resize anchors and
  // handles rotate together with the card.
  const rootStyle: CSSProperties = {
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center',
    transition: 'transform 120ms ease',
  };

  const cardStyle: CSSProperties = {
    ...(entity.borderColor ? { borderColor: entity.borderColor } : {}),
    ...(entity.borderWidth !== undefined ? { borderWidth: `${entity.borderWidth}px` } : {}),
    ...(entity.rounded !== undefined ? { borderRadius: entity.rounded ? '4px' : '0' } : {}),
    ...(entity.shadow ? { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' } : {}),
    opacity: visualOpacity,
    transition: 'box-shadow 150ms ease',
  };

  const weakInnerBorderStyle: CSSProperties = {
    inset: `${Math.max(3, borderWidth + 2)}px`,
    borderColor,
    borderWidth: `${borderWidth}px`,
    borderRadius: cardRadius === '0' ? '0' : '2px',
  };

  const headerStyle: CSSProperties = entity.fillColor
    ? { backgroundColor: entity.fillColor }
    : {};

  // Live font/size preview (toolbar / Text-tab hover). Keyed by this node's id;
  // never touches data — each field falls back to the committed value.
  const previewValue = useFontPreviewStore((s) => s.value);
  const preview = previewValue?.targetId === id ? previewValue : null;
  const previewFontFamily = preview?.fontFamily ?? entity.fontFamily;
  const previewFontSize = preview?.fontSize ?? entity.fontSize;

  const titleStyle: CSSProperties = {
    ...(entity.textColor ? { color: entity.textColor } : {}),
    ...(previewFontFamily ? { fontFamily: previewFontFamily } : {}),
    ...(previewFontSize ? { fontSize: `${previewFontSize}px` } : {}),
    ...(entity.bold !== undefined ? { fontWeight: entity.bold ? 700 : 500 } : {}),
    ...(entity.italic ? { fontStyle: 'italic' } : {}),
    ...(entity.underline ? { textDecoration: 'underline' } : {}),
    ...(entity.textAlign ? { textAlign: entity.textAlign as CSSProperties['textAlign'] } : {}),
  };

  // Field name text follows the same colour/font choice for consistency.
  const fieldNameStyle: CSSProperties = {
    ...(entity.textColor ? { color: entity.textColor } : {}),
    ...(previewFontFamily ? { fontFamily: previewFontFamily } : {}),
  };

  // ─── Double-click to edit (title + each field), like connection labels ──
  // `editingKey` marks which input ('title' or 'field:<i>') is editable; only
  // a double-click on its row sets it.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());

  function registerInput(key: string) {
    return (el: HTMLInputElement | null) => {
      if (el) inputRefs.current.set(key, el);
      else inputRefs.current.delete(key);
    };
  }

  function startEdit(key: string) {
    setEditingKey(key);
    // Focus + select the input the moment its row becomes editable (the
    // Svelte `editable` action's behaviour).
    requestAnimationFrame(() => {
      const el = inputRefs.current.get(key);
      el?.focus();
      el?.select();
    });
  }

  function endEdit(evt?: React.FocusEvent<HTMLInputElement>) {
    setEditingKey(null);
    // Clear any lingering selection highlight after a blur that xyflow's
    // preventDefault()ed outside click didn't replace.
    const input = evt?.currentTarget;
    if (input instanceof HTMLInputElement) input.setSelectionRange(0, 0);
    window.getSelection()?.removeAllRanges();
  }

  function onFieldKeydown(evt: React.KeyboardEvent<HTMLInputElement>) {
    evt.stopPropagation(); // keep keys out of xyflow's global shortcuts
    if ((evt.key === 'Enter' && !evt.shiftKey) || evt.key === 'Escape') {
      evt.preventDefault();
      evt.currentTarget.blur(); // → endEdit
    }
  }

  // Clicking outside the node deselects it; end the edit through blur.
  useEffect(() => {
    if (editingKey !== null && !selected) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  }, [editingKey, selected]);

  // While editing, ANY pointerdown outside the focused input ends the edit.
  useEffect(() => {
    if (editingKey === null) return;
    const onPointerDown = (e: PointerEvent) => {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        e.target instanceof Node &&
        active !== e.target &&
        !active.contains(e.target)
      ) {
        active.blur();
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [editingKey]);

  return (
    <div
      className={`group relative h-full w-full min-w-[180px] min-h-[80px] ${selected ? 'active' : ''}`}
      style={rootStyle}
    >
      <div
        className="entity-card relative flex h-full w-full flex-col overflow-hidden rounded-[4px] border
          border-[#373a36] bg-white font-sans shadow-[0_2px_6px_rgba(0,0,0,0.06)] transition-shadow
          duration-150 group-hover:shadow-[0_4px_12px_rgba(166,25,46,0.15)]
          group-[.active]:shadow-[0_4px_12px_rgba(166,25,46,0.15)]"
        style={cardStyle}
      >
        {entity.weak ? (
          <span
            className="pointer-events-none absolute z-10 border"
            style={weakInnerBorderStyle}
            aria-hidden="true"
          />
        ) : null}

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <header
          className="border-b border-[#373a36] px-3 py-2 text-center select-none"
          style={headerStyle}
          onDoubleClick={(e) => {
            e.stopPropagation();
            startEdit('title');
          }}
        >
          <input
            ref={registerInput('title')}
            className={`nodrag w-full border-none bg-transparent p-0 text-center text-[13px] font-medium
              text-ink outline-none placeholder:text-[rgba(44,44,42,0.45)]
              ${editingKey === 'title' ? 'pointer-events-auto cursor-text select-text' : 'pointer-events-none cursor-[inherit]'}`}
            type="text"
            value={entity.label ?? ''}
            spellCheck={false}
            readOnly={editingKey !== 'title'}
            onChange={(event) => setLabel(event.currentTarget.value)}
            onKeyDown={onFieldKeydown}
            onBlur={endEdit}
            style={titleStyle}
          />
        </header>

        <ul className="m-0 flex list-none flex-col p-0 select-none">
          {entity.fields.map((field, index) => {
            const key = resolveFieldKey(field);
            const editKey = `field:${index}`;
            return (
              // eslint-disable-next-line jsx-a11y/no-static-element-interactions
              <li
                key={index}
                className="flex items-center border-t-[0.5px] border-line px-3 py-2
                  first:border-t first:border-[#373a36]"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEdit(editKey);
                }}
              >
                <span className="mr-2 inline-flex min-w-[36px] flex-shrink-0 items-center gap-1">
                  {key ? (
                    <span
                      className={`${BADGE_CLASS[key] ?? ''} inline-block rounded-[2px] px-[5px] py-px text-[10px] font-semibold leading-[1.4]`}
                    >
                      {key}
                    </span>
                  ) : null}
                  {field.optionalKey ? (
                    <span
                      className={`${BADGE_CLASS[field.optionalKey] ?? ''} inline-block rounded-[2px] px-[5px] py-px text-[10px] font-semibold leading-[1.4]`}
                    >
                      {field.optionalKey}
                    </span>
                  ) : null}
                </span>
                <input
                  ref={registerInput(editKey)}
                  className={`nodrag min-w-0 flex-1 border-none bg-transparent p-0 text-[12px] text-ink-soft
                    outline-none ${key === 'PK' ? 'font-medium' : ''}
                    ${editingKey === editKey ? 'pointer-events-auto cursor-text select-text' : 'pointer-events-none cursor-[inherit]'}`}
                  type="text"
                  value={field.name}
                  spellCheck={false}
                  readOnly={editingKey !== editKey}
                  onChange={(event) => setFieldName(index, event.currentTarget.value)}
                  onKeyDown={onFieldKeydown}
                  onBlur={endEdit}
                  style={fieldNameStyle}
                />
                {/* Field type rendering is gated by the panel's master toggle. */}
                {entity.showDataTypes && field.type ? (
                  <span className="ml-2 flex-shrink-0 text-right text-[11px] tracking-[0.02em] text-[#888] uppercase">
                    {field.type.toUpperCase()}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={80}
        handleClassName="entity-resize-anchor"
        lineClassName="entity-resize-line"
      />

      {[Position.Top, Position.Right, Position.Bottom, Position.Left].map((pos) => (
        <Handle
          key={pos}
          type="source"
          position={pos}
          id={pos}
          className="entity-handle pointer-events-none opacity-0 transition-opacity duration-[120ms]
            group-hover:pointer-events-auto group-hover:opacity-100
            group-[.active]:pointer-events-auto group-[.active]:opacity-100"
        />
      ))}
    </div>
  );
}
