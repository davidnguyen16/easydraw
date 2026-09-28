import { getBezierPath, getSmoothStepPath, getStraightPath, type Position } from '@xyflow/react';
import { safeArtworkColor } from '@/lib/flow/nodes/vector/vector-artwork';

interface Endpoints {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
}

/** Shared XYFlow routing primitives, with no editable connection machinery. */
export function previewEdgePath(points: Endpoints, routing: unknown): [string, number, number, number, number] {
  if (routing === 'straight') return getStraightPath(points);
  if (routing === 'curved') return getBezierPath(points);
  return getSmoothStepPath({ ...points, borderRadius: 10 });
}

export function previewEdgeAppearance(data: Record<string, unknown> | undefined) {
  const lineStyle = data?.lineStyle ?? data?.dash;
  return {
    stroke: safeArtworkColor(data?.strokeColor, '#777168'),
    strokeWidth: typeof data?.strokeWidth === 'number' && Number.isFinite(data.strokeWidth)
      ? Math.max(0, Math.min(12, data.strokeWidth)) : 1.5,
    strokeDasharray: lineStyle === 'dashed' ? '8 5' : lineStyle === 'dotted' ? '1 5' : undefined,
    strokeLinecap: 'round' as const,
  };
}
