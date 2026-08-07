'use client';

/**
 * Live connection-line preview shown while the user drags out a new edge.
 * Renders with the SAME node-aware router (`routeOrthogonal`) the final
 * ConnectionEdge uses, so what you drag is what you get, and the preview
 * bends around the target node instead of cutting through it.
 */
import { Position, useConnection } from '@xyflow/react';
import { ENDPOINT_INSET, outlineInsetRatioForType } from './endpoint-insets';
import { buildSvgPath, routeOrthogonal, type Rect } from './routing';

const CORNER_RADIUS = 8;

// Inset fraction for a node's connection end at `position`, or 0 when this end
// doesn't inset. The table lives in endpoint-insets.ts — ONE source shared
// with ConnectionEdge so preview and released edge can never disagree.
function outlineInsetRatio(node: unknown, position: Position | null | undefined): number {
  if (position == null) return 0;
  const type = (node as { type?: string } | null | undefined)?.type;
  return outlineInsetRatioForType(type, position);
}

// Current rendered box of an internal node (origin/measured aware).
function rectOf(node: unknown): Rect | null {
  const n = node as
    | {
        internals?: { positionAbsolute?: { x: number; y: number } };
        position?: { x: number; y: number };
        measured?: { width?: number; height?: number };
        width?: number;
        height?: number;
      }
    | null
    | undefined;
  if (!n) return null;
  const pos = n.internals?.positionAbsolute ?? n.position;
  const width = n.measured?.width ?? n.width;
  const height = n.measured?.height ?? n.height;
  if (!pos || width == null || height == null) return null;
  return { x: pos.x, y: pos.y, width, height };
}

// Mirrors ConnectionEdge.insetForEnd for inset outline ends.
function insetSideEnd(
  node: unknown,
  p: { x: number; y: number },
  position: Position | null | undefined,
): { x: number; y: number } {
  const ratio = outlineInsetRatio(node, position);
  if (ratio > 0) {
    const rect = rectOf(node);
    if (rect) {
      const dx = rect.width * ratio + ENDPOINT_INSET;
      const dy = rect.height * ratio + ENDPOINT_INSET;
      if (position === Position.Left) return { x: p.x + dx, y: p.y };
      if (position === Position.Right) return { x: p.x - dx, y: p.y };
      if (position === Position.Top) return { x: p.x, y: p.y + dy };
      if (position === Position.Bottom) return { x: p.x, y: p.y - dy };
    }
  }
  return p;
}

export default function ConnectionLinePreview() {
  const connection = useConnection();

  if (!connection.inProgress) return null;

  // No node under the pointer → the end is FLOATING; resolve to the exact
  // same path the released edge will draw once an anchor lands here.
  const targetFloating = !connection.toNode;
  const points = routeOrthogonal({
    source: insetSideEnd(connection.fromNode, connection.from, connection.fromPosition),
    sourcePosition: connection.fromPosition,
    sourceRect:
      outlineInsetRatio(connection.fromNode, connection.fromPosition) > 0
        ? null
        : rectOf(connection.fromNode),
    target: targetFloating
      ? connection.to
      : insetSideEnd(connection.toNode, connection.to, connection.toPosition),
    targetPosition: connection.toPosition,
    targetRect:
      targetFloating || outlineInsetRatio(connection.toNode, connection.toPosition) > 0
        ? null
        : rectOf(connection.toNode),
    targetFloating,
  });
  const pathD = buildSvgPath(
    points.map((point) => ({ point, bendIndex: null as number | null })),
    CORNER_RADIUS,
  );

  return (
    <path
      d={pathD}
      fill="none"
      className="react-flow__connection-path"
      style={{ stroke: '#A6192E', strokeWidth: '1.5px' }}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
