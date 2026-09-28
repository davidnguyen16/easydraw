'use client';

import { useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { spatialData } from './editing-actions';
import type { DiagramSceneNode } from './scene-model';
import { editableEdgeLabels } from './edge-editing';

function NumberField({ label, value, min = -100000, max = 100000, onCommit }: {
  label: string; value: number; min?: number; max?: number; onCommit(value: number): void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return <label className="flex items-center justify-between gap-3 text-xs text-ink-soft">{label}
    <input type="number" aria-label={label} value={draft ?? Number(value.toFixed(3))} step={0.1} min={min} max={max}
      className="w-24 rounded border border-line bg-white px-2 py-1.5 text-ink"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => { if (draft !== null && draft.trim() && Number.isFinite(Number(draft))) onCommit(Math.min(max, Math.max(min, Number(draft)))); setDraft(null); }}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setDraft(null); }} />
  </label>;
}

export function SpatialControls({ node, sceneNode, onChange, onToggleLock }: {
  node: Node; sceneNode?: DiagramSceneNode; onChange(patch: Record<string, unknown>): void; onToggleLock(): void;
}) {
  const spatial = spatialData(node);
  const value = (key: string, fallback = 0) => typeof spatial[key] === 'number' ? spatial[key] as number : fallback;
  const change = (key: string, next: number) => onChange({ spatial3d: { ...spatial, [key]: next } });
  return <div className="flex flex-col gap-4">
    <p className="text-xs text-ink-muted">X/Y, size and rotation in Arrange are shared with 2D. Elevation is relative to the diagram plane. Depth uses scene units (1 unit = 100 diagram pixels).</p>
    <fieldset disabled={!!node.data.locked} className="flex flex-col gap-3 disabled:opacity-50">
      <NumberField label="Elevation" value={value('elevation', node.parentId ? 0 : 0.04)} onCommit={(n) => change('elevation', n)} />
      {node.type === 'SourceImageNode'
        ? <p className="text-xs text-ink-muted">This source image stays flat. Its pixels do not contain a 3D model.</p>
        : <NumberField label="Depth" value={value('depth', sceneNode?.size[1] ?? 0.4)} min={0.02} max={1000} onCommit={(n) => change('depth', n)} />}
      <NumberField label="Tilt X" value={value('rotationX') * 180 / Math.PI} min={-360} max={360} onCommit={(n) => change('rotationX', n * Math.PI / 180)} />
      <NumberField label="Tilt Z" value={value('rotationZ') * 180 / Math.PI} min={-360} max={360} onCommit={(n) => change('rotationZ', n * Math.PI / 180)} />
      <button type="button" className="rounded border border-line p-2 text-xs" onClick={() => onChange({ spatial3d: {} })}>Reset 3D depth and tilt</button>
    </fieldset>
    <button type="button" className="rounded border border-line p-2 text-xs" onClick={onToggleLock}>{node.data.locked ? 'Unlock object' : 'Lock object'}</button>
  </div>;
}

export function ConnectionControls3D({ edge, nodes, onChange, onReconnect }: {
  edge: Edge; nodes: Node[]; onChange(patch: Record<string, unknown>): void;
  onReconnect(end: 'source' | 'target', nodeId: string): void;
}) {
  const labels = editableEdgeLabels(edge);
  const bends = Array.isArray(edge.data?.bendPoints) ? edge.data.bendPoints : [];
  return <div className="flex flex-col gap-3 text-xs">
    {(['source', 'target'] as const).map((end) => <label className="flex flex-col gap-1" key={end}>{end === 'source' ? 'Source' : 'Target'}
      <select aria-label={`Connection ${end}`} value={edge[end]} onChange={(event) => onReconnect(end, event.target.value)} className="rounded border border-line bg-white p-2">
        {nodes.map((node, index) => <option key={node.id} value={node.id}>{String(node.data.label || node.data.name || node.type || 'Object')} · {index + 1}</option>)}
      </select>
    </label>)}
    {labels.map((label, index) => <div key={label.id} className="flex flex-col gap-2"><div className="flex items-center gap-1">
      <input aria-label={`Connection label ${index + 1}`} className="min-w-0 flex-1 rounded border border-line px-2 py-1"
        key={`${label.id}:${label.text}`} defaultValue={label.text}
        onBlur={(event) => { if (event.target.value !== label.text) onChange({ labels: labels.map((item) => item.id === label.id ? { ...item, text: event.target.value } : item) }); }} />
      <button type="button" aria-label={`Remove label ${index + 1}`} onClick={() => onChange({ labels: labels.filter((item) => item.id !== label.id) })}>×</button>
    </div><NumberField label={`Label ${index + 1} position (%)`} min={0} max={100} value={label.t * 100} onCommit={(value) => onChange({ labels: labels.map((item) => item.id === label.id ? { ...item, t: value / 100 } : item) })} /></div>)}
    <button type="button" className="rounded border border-line p-2" onClick={() => onChange({ labels: [...labels, { id: nanoid(), t: 0.5, text: 'Label' }] })}>Add connection label</button>
    {!!bends.length && <button type="button" className="rounded border border-line p-2" onClick={() => onChange({ bendPoints: [] })}>Clear bend points ({bends.length})</button>}
  </div>;
}
