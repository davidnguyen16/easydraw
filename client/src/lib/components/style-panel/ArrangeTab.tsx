'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import type { Node } from '@xyflow/react';
import {
  nearestRotationEquivalent,
  normalizeRotation,
  toFiniteRotation,
} from '@/lib/flow/nodes/style-utils';
import type { NodeStyleData } from './types';
import {
  ACTION_BTN,
  ACTION_BTN_DANGER,
  GROUP,
  GROUP_LABEL,
  NUM_FIELD,
  NUM_FIELD_INPUT,
  NUM_FIELD_LABEL,
  ROW,
  ROW_LABEL,
  STEPPER_BTN,
} from './ui';

interface Props {
  node: Node;
  style: NodeStyleData;
  onStyleChange: (patch: Partial<NodeStyleData>) => void;
  onPositionChange: (x: number, y: number) => void;
  onSizeChange: (width: number, height: number) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export default function ArrangeTab({
  node,
  style,
  onStyleChange,
  onPositionChange,
  onSizeChange,
  onBringToFront,
  onSendToBack,
  onDuplicate,
  onDelete,
}: Props) {
  // Inputs pull live values from the node, but keep local state so commits
  // wait for change/blur.
  const nodeX = Math.round(node.position?.x ?? 0);
  const nodeY = Math.round(node.position?.y ?? 0);
  const nodeW = Math.round((node.measured?.width as number) ?? (node.width as number) ?? 0);
  const nodeH = Math.round((node.measured?.height as number) ?? (node.height as number) ?? 0);

  const [xInput, setXInput] = useState(nodeX);
  const [yInput, setYInput] = useState(nodeY);
  const [wInput, setWInput] = useState(nodeW);
  const [hInput, setHInput] = useState(nodeH);

  // Seed and re-seed inputs from the selected node's live geometry.
  useEffect(() => setXInput(nodeX), [nodeX]);
  useEffect(() => setYInput(nodeY), [nodeY]);
  useEffect(() => setWInput(nodeW), [nodeW]);
  useEffect(() => setHInput(nodeH), [nodeH]);

  const commitPosition = () => onPositionChange(xInput, yInput);
  const commitSize = () => onSizeChange(Math.max(1, wInput), Math.max(1, hInput));

  // ─── Rotation ────────────────────────────────────────────────────────
  const rotationRaw = toFiniteRotation(style.rotation);
  const rotation = normalizeRotation(rotationRaw);
  const [rotationDraft, setRotationDraft] = useState<string | null>(null);

  function setRotation(next: number) {
    setRotationDraft(null);
    onStyleChange({ rotation: toFiniteRotation(next) });
  }

  function commitRotation() {
    if (rotationDraft !== null) {
      const n = parseFloat(rotationDraft);
      if (!Number.isNaN(n)) {
        setRotation(nearestRotationEquivalent(n, rotationRaw));
      }
    }
    setRotationDraft(null);
  }

  function onRotationKeydown(event: React.KeyboardEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (event.key === 'Enter') {
      event.preventDefault();
      commitRotation();
      input.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setRotationDraft(null);
      input.blur();
    }
  }

  return (
    <>
      <section className={GROUP}>
        <h3 className={GROUP_LABEL}>POSITION</h3>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <label className={NUM_FIELD}>
            <span className={NUM_FIELD_LABEL}>X</span>
            <input
              className={NUM_FIELD_INPUT}
              type="number"
              value={xInput}
              onChange={(e) => setXInput(e.currentTarget.valueAsNumber || 0)}
              onBlur={commitPosition}
            />
          </label>
          <label className={NUM_FIELD}>
            <span className={NUM_FIELD_LABEL}>Y</span>
            <input
              className={NUM_FIELD_INPUT}
              type="number"
              value={yInput}
              onChange={(e) => setYInput(e.currentTarget.valueAsNumber || 0)}
              onBlur={commitPosition}
            />
          </label>
        </div>
      </section>

      <section className={GROUP}>
        <h3 className={GROUP_LABEL}>SIZE</h3>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <label className={NUM_FIELD}>
            <span className={NUM_FIELD_LABEL}>W</span>
            <input
              className={NUM_FIELD_INPUT}
              type="number"
              value={wInput}
              onChange={(e) => setWInput(e.currentTarget.valueAsNumber || 0)}
              onBlur={commitSize}
            />
          </label>
          <label className={NUM_FIELD}>
            <span className={NUM_FIELD_LABEL}>H</span>
            <input
              className={NUM_FIELD_INPUT}
              type="number"
              value={hInput}
              onChange={(e) => setHInput(e.currentTarget.valueAsNumber || 0)}
              onBlur={commitSize}
            />
          </label>
        </div>
      </section>

      <section className={GROUP}>
        <h3 className={GROUP_LABEL}>ROTATION</h3>
        <div className={ROW}>
          <span className={ROW_LABEL}>Angle</span>
          <div className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-1 py-0.5">
            <button
              type="button"
              className={STEPPER_BTN}
              aria-label="Rotate counterclockwise 1 degree"
              onClick={() => setRotation(rotationRaw - 1)}
            >
              <RotateCcw size={14} strokeWidth={2} />
            </button>
            <label className="flex items-center">
              <input
                className="w-10 min-w-0 border-none bg-transparent p-0 text-right text-[0.85rem]
                  tabular-nums text-ink-soft outline-none [appearance:textfield]
                  [&::-webkit-inner-spin-button]:appearance-none
                  [&::-webkit-outer-spin-button]:appearance-none"
                type="text"
                inputMode="numeric"
                aria-label="Rotation degrees"
                value={rotationDraft ?? `${rotation}`}
                onChange={(e) => setRotationDraft(e.currentTarget.value)}
                onFocus={(e) => {
                  setRotationDraft(`${rotation}`);
                  e.currentTarget.select();
                }}
                onBlur={commitRotation}
                onKeyDown={onRotationKeydown}
              />
              <span className="pl-0.5 text-[0.78rem] text-ink-muted">°</span>
            </label>
            <button
              type="button"
              className={STEPPER_BTN}
              aria-label="Rotate clockwise 1 degree"
              onClick={() => setRotation(rotationRaw + 1)}
            >
              <RotateCw size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md
            border border-line bg-white p-2.5 text-[0.85rem] font-medium text-ink-soft
            transition-colors duration-[120ms] hover:border-mq-maroon hover:text-mq-maroon"
          onClick={() => setRotation(rotationRaw + 90)}
        >
          <RotateCw size={15} strokeWidth={2} />
          Rotate 90°
        </button>
      </section>

      <section className={GROUP}>
        <h3 className={GROUP_LABEL}>ORDER</h3>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <button type="button" className={ACTION_BTN} onClick={onBringToFront}>
            To front
          </button>
          <button type="button" className={ACTION_BTN} onClick={onSendToBack}>
            To back
          </button>
        </div>
      </section>

      <section className={GROUP}>
        <h3 className={GROUP_LABEL}>ACTIONS</h3>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <button type="button" className={ACTION_BTN} onClick={onDuplicate}>
            Duplicate
          </button>
          <button type="button" className={ACTION_BTN_DANGER} onClick={onDelete}>
            Delete
          </button>
        </div>
      </section>
    </>
  );
}
