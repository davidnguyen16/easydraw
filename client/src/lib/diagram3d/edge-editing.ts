import type { Edge } from '@xyflow/react';

/** Normalize only while editing; importing/viewing a legacy graph never rewrites it. */
export function editableEdgeLabels(edge: Edge): { id: string; text: string; t: number }[] {
  const raw = Array.isArray(edge.data?.labels) ? edge.data.labels : [];
  const labels = raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || typeof item.text !== 'string' || !item.text) return [];
    return [{ id: typeof item.id === 'string' && item.id ? item.id : `${edge.id}:label:${index}`, text: item.text,
      t: typeof item.t === 'number' && Number.isFinite(item.t) ? Math.max(0, Math.min(1, item.t)) : 0.5 }];
  });
  const legacy = typeof edge.label === 'string' ? edge.label : typeof edge.data?.label === 'string' ? edge.data.label : undefined;
  if (legacy && !labels.some((label) => label.text === legacy)) labels.push({ id: `${edge.id}:legacy`, text: legacy, t: 0.5 });
  return labels;
}
