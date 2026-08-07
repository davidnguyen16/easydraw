'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Position, useReactFlow, type EdgeProps } from '@xyflow/react';
import ConnectionLabels from './ConnectionLabels';
import EndpointHandle from './EndpointHandle';
import Pill from './Pill';
import {
  buildBezier,
  buildSegments,
  buildSvgPath,
  buildVertices,
  longestSegmentMidpoint,
  positionToAxis,
  routeOrthogonal,
  type Rect,
} from './routing';
import { ANCHOR_HANDLE_ID, ANCHOR_NODE_TYPE } from '../nodes/anchor/anchor';
import MarkerGlyph from './MarkerGlyph';
import { MARKER_GLYPHS } from './marker-glyphs';
import { useConnectionLabelEditor } from './connection-label-editor';
import { insetForEnd, outlineInsetRatioForType } from './endpoint-insets';
import { useFlowStore } from '../flow-store';
import type {
  Axis,
  ConnectionEdgeData,
  ConnectionLabel,
  MarkerKind,
  Point,
  Segment,
} from './types';

// ─── Visual constants ───────────────────────────────────────────────
const COLOR_DEFAULT = '#B4B2A9';
const COLOR_ACTIVE = '#5F5E5A';
const WIDTH_DEFAULT = 1.5;
const CORNER_RADIUS = 8;
const HIT_WIDTH = 20;
// The canvas background colour. A double line paints a stroke of this colour
// over the centre of a wider colour stroke to carve the gap between its two
// rails. Keep in sync if the canvas ever stops being white.
const CANVAS_BG = '#ffffff';

export default function ConnectionEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  selected,
  data,
}: EdgeProps) {
  const flow = useReactFlow();

  // Editor actions the edge can't perform itself — only the store owns the
  // nodes/edges arrays (ported from Flow.svelte's setContext functions).
  const addAnchorNode = useFlowStore((s) => s.addAnchorNode);
  const selectEdgeForStyling = useFlowStore((s) => s.selectEdgeForStyling);
  const moveFloatingConnection = useFlowStore((s) => s.moveFloatingConnection);

  const [hovered, setHovered] = useState(false);
  // Which end (if any) is currently being reconnect-dragged. Kept so the
  // endpoint handles + active styling stay visible for the whole drag.
  const [draggingEnd, setDraggingEnd] = useState<'source' | 'target' | null>(null);
  // True while the whole connection is being rigid-dragged.
  const [movingWhole, setMovingWhole] = useState(false);
  // Pointer position over the edge (flow coords) — drives the single ghost pill.
  const [hoverFlowPos, setHoverFlowPos] = useState<Point | null>(null);

  const connectionData = (data ?? {}) as ConnectionEdgeData;
  const bendPoints = connectionData.bendPoints ?? [];

  // ─── Line appearance (driven by ConnectionStylePanel) ───────────────
  const routing = connectionData.routing ?? 'orthogonal';
  const isOrthogonal = routing === 'orthogonal';
  const lineStyle = connectionData.lineStyle ?? 'solid';
  const lineCap = connectionData.lineCap ?? 'round';
  // A near-zero dash only becomes a visible dot with round caps.
  const renderedLineCap = lineStyle === 'dotted' ? 'round' : lineCap;
  const markerStart: MarkerKind = connectionData.markerStart ?? 'none';
  const markerEnd: MarkerKind = connectionData.markerEnd ?? 'none';
  const userStrokeWidth = connectionData.strokeWidth ?? WIDTH_DEFAULT;
  const userStrokeColor = connectionData.strokeColor;

  // Dash pattern scales with width so dashes/dots stay legible on thick lines.
  const dashArray =
    lineStyle === 'dashed'
      ? `${userStrokeWidth * 5} ${userStrokeWidth * 3.5}`
      : lineStyle === 'dotted'
        ? `${userStrokeWidth} ${userStrokeWidth * 2}`
        : undefined;

  const startGlyph = markerStart === 'none' ? null : MARKER_GLYPHS[markerStart];
  const endGlyph = markerEnd === 'none' ? null : MARKER_GLYPHS[markerEnd];

  // ─── Label text style ───────────────────────────────────────────────
  const labelFontFamily = connectionData.fontFamily ?? 'Inter';
  const labelFontSize = connectionData.fontSize ?? 13;
  const labelBold = !!connectionData.bold;
  const labelItalic = !!connectionData.italic;
  const labelUnderline = !!connectionData.underline;
  const labelColor = connectionData.textColor ?? '#1f1d1a';

  const labelStyle: CSSProperties = {
    color: labelColor,
    fontFamily: labelFontFamily,
    fontSize: `${labelFontSize}px`,
    // Unbolded labels stay semibold (600) for legibility over the line.
    fontWeight: labelBold ? 700 : 600,
    fontStyle: labelItalic ? 'italic' : 'normal',
    textDecoration: labelUnderline ? 'underline' : 'none',
  };

  function nodeTypeOf(nodeId: string): string | undefined {
    return flow.getInternalNode(nodeId)?.type;
  }

  // Current rendered box of a node (handles origin/measured size).
  function rectOf(nodeId: string): Rect | null {
    const node = flow.getInternalNode(nodeId);
    if (!node) return null;
    const pos = node.internals?.positionAbsolute ?? node.position;
    const width = node.measured?.width ?? (node as { width?: number }).width;
    const height = node.measured?.height ?? (node as { height?: number }).height;
    if (pos == null || width == null || height == null) return null;
    return { x: pos.x, y: pos.y, width, height };
  }

  function outlineInsetRatio(nodeId: string, position: Position): number {
    return outlineInsetRatioForType(nodeTypeOf(nodeId), position);
  }

  function insetForNodeEnd(
    nodeId: string,
    point: Point,
    position: Position,
    marker: MarkerKind = 'none',
  ): Point {
    return insetForEnd({
      nodeType: nodeTypeOf(nodeId),
      point,
      position,
      marker,
      rect: rectOf(nodeId),
    });
  }

  // A connection anchor is a free wire end — treat it as FLOATING.
  function isAnchor(nodeId: string): boolean {
    return flow.getInternalNode(nodeId)?.type === ANCHOR_NODE_TYPE;
  }

  const sourceFloating = isAnchor(source);
  const targetFloating = isAnchor(target);
  // BOTH ends floating → free-standing object; the line body rigid-moves it.
  const fullyFloating = sourceFloating && targetFloating;

  // Anchor nodes use origin [0.5, 0.5]; their node position is the exact
  // visual centre of the floating endpoint.
  function floatingAnchorPoint(nodeId: string, fallback: Point): Point {
    return flow.getNode(nodeId)?.position ?? fallback;
  }

  const sourcePoint = sourceFloating
    ? floatingAnchorPoint(source, { x: sourceX, y: sourceY })
    : insetForNodeEnd(source, { x: sourceX, y: sourceY }, sourcePosition, markerStart);
  const targetPoint = targetFloating
    ? floatingAnchorPoint(target, { x: targetX, y: targetY })
    : insetForNodeEnd(target, { x: targetX, y: targetY }, targetPosition, markerEnd);
  const sourceAxis = positionToAxis(sourcePosition);

  const isFreeForm = bendPoints.length === 0;

  // WYSIWYG + no piercing: a pristine edge routes with the node-aware
  // orthogonal router — the SAME router the connection-line preview uses.
  const routedPoints = routeOrthogonal({
    source: sourcePoint,
    sourcePosition,
    sourceRect:
      sourceFloating || outlineInsetRatio(source, sourcePosition) > 0 ? null : rectOf(source),
    sourceFloating,
    target: targetPoint,
    targetPosition,
    targetRect:
      targetFloating || outlineInsetRatio(target, targetPosition) > 0 ? null : rectOf(target),
    targetFloating,
  });

  // 'curved' routing: bezier path + a polyline sampling for segment math.
  const curve =
    routing === 'curved'
      ? buildBezier({
          source: sourcePoint,
          sourcePosition,
          target: targetPoint,
          targetPosition,
          sourceFloating,
          targetFloating,
        })
      : null;

  const vertices = (() => {
    if (routing === 'straight') {
      return [sourcePoint, targetPoint].map((point) => ({
        point,
        bendIndex: null as number | null,
      }));
    }
    if (curve) {
      return curve.samples.map((point) => ({ point, bendIndex: null as number | null }));
    }
    return isFreeForm
      ? routedPoints.map((point) => ({ point, bendIndex: null as number | null }))
      : buildVertices(sourcePoint, targetPoint, sourceAxis, bendPoints);
  })();
  const segments = buildSegments(vertices);
  const pathD = curve ? curve.d : buildSvgPath(vertices, CORNER_RADIUS);

  const labels = (connectionData.labels ?? []) as ConnectionLabel[];

  // ─── Path arc-length math (positions labels ALONG the line) ─────────
  // Must stay ABOVE the label footprints below: those call pointAtT during
  // render, and `pointAtT` reads these two consts. Declaring them afterwards
  // throws "Cannot access 'totalLength' before initialization" for any
  // connection that carries a label (an empty label list never calls it, which
  // is what made this look intermittent).
  const segLengths = segments.map((s) => Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y));
  const totalLength = segLengths.reduce((sum, l) => sum + l, 0);

  function pointAtT(t: number): Point {
    if (segments.length === 0) return { x: sourcePoint.x, y: sourcePoint.y };
    const target = Math.max(0, Math.min(1, t)) * totalLength;
    let acc = 0;
    for (let i = 0; i < segments.length; i++) {
      const len = segLengths[i];
      if (acc + len >= target || i === segments.length - 1) {
        const f = len === 0 ? 0 : (target - acc) / len;
        const s = segments[i];
        return { x: s.p1.x + (s.p2.x - s.p1.x) * f, y: s.p1.y + (s.p2.y - s.p1.y) * f };
      }
      acc += len;
    }
    return segments[segments.length - 1].p2;
  }

  // Footprint of each committed label so pills can DODGE the text.
  const labelCharPx = Math.max(7, labelFontSize * 0.55);
  const labelBoxes = labels.map((l) => {
    const c = pointAtT(l.t);
    return {
      cx: c.x,
      cy: c.y,
      halfW: Math.max(10, (l.text.length * labelCharPx) / 2) + 12,
      halfH: Math.max(21, labelFontSize + 8),
    };
  });
  function nearLabel(p: Point): boolean {
    return labelBoxes.some((b) => Math.abs(b.cx - p.x) < b.halfW && Math.abs(b.cy - p.y) < b.halfH);
  }

  // Clamped projection of `p` onto segment a→b: fraction along + distance.
  function projectOnSeg(p: Point, a: Point, b: Point): { f: number; dist: number } {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let f = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    f = Math.max(0, Math.min(1, f));
    return { f, dist: Math.hypot(p.x - (a.x + f * dx), p.y - (a.y + f * dy)) };
  }

  // Normalised position of the path point CLOSEST to a flow point `p`.
  function tAtFlowPoint(p: Point): number {
    if (totalLength === 0) return 0.5;
    let bestDist = Infinity;
    let bestLenAlong = 0;
    let acc = 0;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const proj = projectOnSeg(p, s.p1, s.p2);
      if (proj.dist < bestDist) {
        bestDist = proj.dist;
        bestLenAlong = acc + proj.f * segLengths[i];
      }
      acc += segLengths[i];
    }
    return bestLenAlong / totalLength;
  }

  // Single "add bend" handle, placed on the longest run of a pristine edge.
  const freeFormLabel = longestSegmentMidpoint(routedPoints);
  const freeFormAxis =
    Math.abs(targetPoint.x - sourcePoint.x) >= Math.abs(targetPoint.y - sourcePoint.y) ? 'h' : 'v';

  // The pristine edge's lone pill slides along the line to dodge labels.
  const freeFormPill = ((): { x: number; y: number; axis: Axis } => {
    const natural = freeFormLabel;
    if (labels.length === 0 || !nearLabel(natural)) {
      return { x: natural.x, y: natural.y, axis: freeFormAxis };
    }
    const base = tAtFlowPoint(natural);
    for (let step = 0.04; step <= 0.5; step += 0.04) {
      for (const t of [base + step, base - step]) {
        if (t <= 0.05 || t >= 0.95) continue;
        const p = pointAtT(t);
        if (!nearLabel(p)) return { x: p.x, y: p.y, axis: freeFormAxis };
      }
    }
    return { x: natural.x, y: natural.y, axis: freeFormAxis };
  })();

  // ─── Cursor-following ghost pill ────────────────────────────────────
  const hoverGhostSegment = ((): Segment | null => {
    if (!hoverFlowPos) return null;
    let best: Segment | null = null;
    let bestDist = Infinity;
    for (const s of segments) {
      if (!s.pillVisible || nearLabel(s.mid)) continue;
      const proj = projectOnSeg(hoverFlowPos, s.p1, s.p2);
      if (proj.dist < bestDist) {
        bestDist = proj.dist;
        best = s;
      }
    }
    return best;
  })();

  const active = hovered || !!selected || draggingEnd !== null;
  const strokeColor = userStrokeColor ?? (active ? COLOR_ACTIVE : COLOR_DEFAULT);
  const strokeWidth = active ? userStrokeWidth + 0.5 : userStrokeWidth;

  // Double-line rails: an outer colour stroke with a canvas-colour stroke over
  // its centre. Widths use userStrokeWidth so the rails don't jump on hover.
  const isDouble = lineStyle === 'double';
  const doubleGap = userStrokeWidth * 1.6;
  const doubleOuterWidth = userStrokeWidth * 2 + doubleGap;

  // Solid pill orientation: prefer the segment LEAVING the bend.
  function axisAtBend(bendIndex: number): 'h' | 'v' {
    const startSeg = segments.find((s) => s.startBendIndex === bendIndex);
    if (startSeg) return startSeg.axis;
    const endSeg = segments.find((s) => s.endBendIndex === bendIndex);
    return endSeg ? endSeg.axis : 'h';
  }

  function patchBendPoints(updater: (prev: Point[]) => Point[]) {
    flow.updateEdge(id, (edge) => {
      const current = (edge.data ?? {}) as ConnectionEdgeData;
      return {
        data: {
          ...current,
          bendPoints: updater(current.bendPoints ?? []),
        },
      };
    });
  }

  function startGhostDrag(segment: Segment, _event: PointerEvent) {
    // Dragging a segment midpoint perpendicular slides the WHOLE segment —
    // that needs TWO bend points (one per endpoint); reuse or insert.
    const segmentAxis = segment.axis;
    const p1 = { ...segment.p1 };
    const p2 = { ...segment.p2 };

    let startIdx = 0;
    let endIdx = 0;

    patchBendPoints((prev) => {
      const next = [...prev];
      let s = segment.startBendIndex;
      let e = segment.endBendIndex;

      if (s === null) {
        next.splice(segment.bendInsertIndex, 0, p1);
        s = segment.bendInsertIndex;
        if (e !== null && e >= segment.bendInsertIndex) e++;
      }
      if (e === null) {
        const insertAt = s + 1;
        next.splice(insertAt, 0, p2);
        e = insertAt;
      }

      startIdx = s;
      endIdx = e;
      return next;
    });

    const onMove = (ev: PointerEvent) => {
      const flowPos = flow.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      // Slide perpendicular to the segment axis.
      const bendA: Point =
        segmentAxis === 'h' ? { x: p1.x, y: flowPos.y } : { x: flowPos.x, y: p1.y };
      const bendB: Point =
        segmentAxis === 'h' ? { x: p2.x, y: flowPos.y } : { x: flowPos.x, y: p2.y };

      patchBendPoints((prev) => {
        if (startIdx >= prev.length || endIdx >= prev.length) return prev;
        const next = [...prev];
        next[startIdx] = bendA;
        next[endIdx] = bendB;
        return next;
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function startSolidDrag(bendIndex: number, _event: PointerEvent) {
    const onMove = (ev: PointerEvent) => {
      const flowPos = flow.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      patchBendPoints((prev) => {
        if (bendIndex >= prev.length) return prev;
        const next = [...prev];
        next[bendIndex] = { x: flowPos.x, y: flowPos.y };
        return next;
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  // Grabbing the single handle on a pristine edge seeds the current interior
  // corners as bends (no visual change), then slides the longest run.
  function startAddBendDrag(event: PointerEvent) {
    const interior = routedPoints.slice(1, -1);

    if (interior.length === 0) {
      const flowPos = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      patchBendPoints(() => [{ x: flowPos.x, y: flowPos.y }]);
      startSolidDrag(0, event);
      return;
    }

    patchBendPoints(() => interior);
    const seeded = buildSegments(buildVertices(sourcePoint, targetPoint, sourceAxis, interior));
    let longest = seeded[0];
    let bestLen = -1;
    for (const seg of seeded) {
      const len = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y);
      if (len > bestLen) {
        bestLen = len;
        longest = seg;
      }
    }
    startGhostDrag(longest, event);
  }

  // ─── Endpoint reconnect drag (draw.io style) ────────────────────────
  const SNAP_DIST = 22;

  function repointEdge(end: 'source' | 'target', nodeId: string, handleId: string | null) {
    flow.updateEdge(id, () =>
      end === 'source'
        ? { source: nodeId, sourceHandle: handleId }
        : { target: nodeId, targetHandle: handleId },
    );
  }

  // The node/handle the endpoint should snap onto for `flowPos`, or null.
  function nearestHandle(flowPos: Point, exclude: { nodeId: string; handleId: string | null }) {
    type Hit = { nodeId: string; handleId: string | null; x: number; y: number };
    let best: Hit | null = null;
    let bestDist = SNAP_DIST;
    let inside: Hit | null = null;
    for (const node of flow.getNodes()) {
      if (node.type === ANCHOR_NODE_TYPE) continue;
      const internal = flow.getInternalNode(node.id);
      const pos = internal?.internals?.positionAbsolute;
      const bounds = internal?.internals?.handleBounds;
      if (!pos || !bounds) continue;

      let nodeBest: Hit | null = null;
      let nodeBestDist = Infinity;
      for (const h of [...(bounds.source ?? []), ...(bounds.target ?? [])]) {
        const hid = h.id ?? null;
        if (node.id === exclude.nodeId && hid === exclude.handleId) continue;
        const hx = pos.x + h.x + h.width / 2;
        const hy = pos.y + h.y + h.height / 2;
        const dd = Math.hypot(hx - flowPos.x, hy - flowPos.y);
        if (dd < nodeBestDist) {
          nodeBestDist = dd;
          nodeBest = { nodeId: node.id, handleId: hid, x: hx, y: hy };
        }
      }
      if (!nodeBest) continue;

      const w = internal.measured?.width ?? 0;
      const h = internal.measured?.height ?? 0;
      if (flowPos.x >= pos.x && flowPos.x <= pos.x + w && flowPos.y >= pos.y && flowPos.y <= pos.y + h) {
        inside = nodeBest;
      }
      if (nodeBestDist < bestDist) {
        bestDist = nodeBestDist;
        best = nodeBest;
      }
    }
    return inside ?? best;
  }

  // Grab an endpoint and drag it; the dragged end rides a temporary anchor.
  function startEndpointDrag(end: 'source' | 'target', event: PointerEvent) {
    event.stopPropagation();
    event.preventDefault();
    setDraggingEnd(end);
    document.body.classList.add('endpoint-dragging');

    const endNodeId = end === 'source' ? source : target;
    const otherEnd = {
      nodeId: end === 'source' ? target : source,
      handleId: (end === 'source' ? targetHandleId : sourceHandleId) ?? null,
    };
    const startPoint =
      end === 'source'
        ? sourceFloating
          ? sourcePoint
          : { x: sourceX, y: sourceY }
        : targetFloating
          ? targetPoint
          : { x: targetX, y: targetY };

    let anchorId: string;
    if (isAnchor(endNodeId)) {
      anchorId = endNodeId;
    } else {
      anchorId = addAnchorNode(startPoint);
      repointEdge(end, anchorId, ANCHOR_HANDLE_ID);
    }

    let snapped: { nodeId: string; handleId: string | null } | null = null;

    // Highlight the node the endpoint will snap onto via `conn-snap-target`.
    let snapNodeId: string | null = null;
    const setSnapTarget = (nodeId: string | null) => {
      if (snapNodeId === nodeId) return;
      if (snapNodeId) flow.updateNode(snapNodeId, { className: undefined });
      snapNodeId = nodeId;
      if (snapNodeId) flow.updateNode(snapNodeId, { className: 'conn-snap-target' });
    };

    const onMove = (ev: PointerEvent) => {
      const flowPos = flow.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      const hit = nearestHandle(flowPos, otherEnd);
      snapped = hit ? { nodeId: hit.nodeId, handleId: hit.handleId } : null;
      setSnapTarget(hit ? hit.nodeId : null);
      const at = hit ? { x: hit.x, y: hit.y } : flowPos;
      flow.updateNode(anchorId, { position: at });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.classList.remove('endpoint-dragging');
      setSnapTarget(null);
      setDraggingEnd(null);
      if (snapped) repointEdge(end, snapped.nodeId, snapped.handleId);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  // ─── Whole-connection move (fully-floating edges only) ──────────────
  function startMoveDrag(event: React.PointerEvent<SVGPathElement>) {
    if (!fullyFloating || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    selectEdgeForStyling(id);
    setMovingWhole(true);

    const dragTarget = event.currentTarget as Element;
    dragTarget.setPointerCapture?.(event.pointerId);

    const startFlow = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const src0 = { ...(flow.getNode(source)?.position ?? sourcePoint) };
    const tgt0 = { ...(flow.getNode(target)?.position ?? targetPoint) };
    const bends0 = bendPoints.map((p) => ({ ...p }));
    document.body.classList.add('connection-dragging');

    const onMove = (ev: PointerEvent) => {
      const flowPos = flow.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      const dx = flowPos.x - startFlow.x;
      const dy = flowPos.y - startFlow.y;
      moveFloatingConnection({
        edgeId: id,
        sourceId: source,
        sourcePosition: { x: src0.x + dx, y: src0.y + dy },
        targetId: target,
        targetPosition: { x: tgt0.x + dx, y: tgt0.y + dy },
        bendPoints: bends0.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (dragTarget.hasPointerCapture?.(event.pointerId)) {
        dragTarget.releasePointerCapture(event.pointerId);
      }
      document.body.classList.remove('connection-dragging');
      setMovingWhole(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  // Label editing controller; the edge supplies only the data patcher.
  function patchLabels(updater: (prev: ConnectionLabel[]) => ConnectionLabel[]) {
    flow.updateEdge(id, (edge) => {
      const current = (edge.data ?? {}) as ConnectionEdgeData;
      return { data: { ...current, labels: updater(current.labels ?? []) } };
    });
  }

  const labelEditor = useConnectionLabelEditor({
    getLabels: () => labels,
    getTotalLength: () => totalLength,
    tAtFlowPoint,
    screenToFlowPosition: (point) => flow.screenToFlowPosition(point),
    patchLabels,
    selectEdgeForStyling: () => selectEdgeForStyling(id),
  });

  useEffect(() => {
    labelEditor.blurIfDeselected(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    return labelEditor.installClickAway();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelEditor.editingId]);

  return (
    <>
      <g
        role="presentation"
        className="connection-edge"
        onDoubleClick={labelEditor.onCreateDblclick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => {
          setHovered(false);
          setHoverFlowPos(null);
        }}
        onPointerMove={(e) =>
          setHoverFlowPos(flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }))
        }
      >
        {/* Endpoint markers. Ids embed the edge id so defs never collide. */}
        <defs>
          {markerStart !== 'none' && startGlyph ? (
            <marker
              id={`cm-s-${id}`}
              viewBox={`0 0 ${startGlyph.w} 10`}
              markerWidth={startGlyph.w}
              markerHeight="10"
              refX={startGlyph.refX}
              refY="5"
              orient="auto-start-reverse"
            >
              <MarkerGlyph kind={markerStart} color={strokeColor} />
            </marker>
          ) : null}
          {markerEnd !== 'none' && endGlyph ? (
            <marker
              id={`cm-e-${id}`}
              viewBox={`0 0 ${endGlyph.w} 10`}
              markerWidth={endGlyph.w}
              markerHeight="10"
              refX={endGlyph.refX}
              refY="5"
              orient="auto"
            >
              <MarkerGlyph kind={markerEnd} color={strokeColor} />
            </marker>
          ) : null}
        </defs>

        {/* Wide invisible interaction strip so the thin line is easy to hit. */}
        <path
          d={pathD}
          fill="none"
          stroke="transparent"
          strokeWidth={HIT_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="stroke"
          className="connection-hit"
          role="presentation"
          style={fullyFloating ? { cursor: 'grab' } : undefined}
          onPointerDown={startMoveDrag}
        />

        {/* The visible line. */}
        {isDouble ? (
          <>
            {/* Double: a wide colour stroke + a canvas-coloured centre stroke
                carve two parallel rails that follow any routing. No markers. */}
            <path
              d={pathD}
              fill="none"
              strokeLinejoin="round"
              pointerEvents="none"
              className="transition-[stroke] duration-[120ms]"
              style={{ stroke: strokeColor, strokeWidth: `${doubleOuterWidth}px` }}
            />
            <path
              d={pathD}
              fill="none"
              strokeLinejoin="round"
              pointerEvents="none"
              style={{ stroke: CANVAS_BG, strokeWidth: `${doubleGap}px` }}
            />
          </>
        ) : (
          <path
            d={pathD}
            fill="none"
            strokeLinecap={renderedLineCap}
            strokeLinejoin="round"
            pointerEvents="none"
            className="transition-[stroke,stroke-width] duration-[120ms]"
            markerStart={markerStart !== 'none' ? `url(#cm-s-${id})` : undefined}
            markerEnd={markerEnd !== 'none' ? `url(#cm-e-${id})` : undefined}
            strokeDasharray={dashArray}
            style={{ stroke: strokeColor, strokeWidth: `${strokeWidth}px` }}
          />
        )}

        {/* Bend pills — orthogonal routing only. */}
        {active && !labelEditor.isEditing && isOrthogonal && !movingWhole ? (
          isFreeForm ? (
            <Pill
              kind="ghost"
              x={freeFormPill.x}
              y={freeFormPill.y}
              axis={freeFormPill.axis}
              onPointerDown={(e) => startAddBendDrag(e)}
            />
          ) : hoverGhostSegment ? (
            <Pill
              kind="ghost"
              x={hoverGhostSegment.mid.x}
              y={hoverGhostSegment.mid.y}
              axis={hoverGhostSegment.axis}
              onPointerDown={(e) => startGhostDrag(hoverGhostSegment, e)}
            />
          ) : null
        ) : null}

        {selected && !labelEditor.isEditing && isOrthogonal
          ? bendPoints.map((bend, bendIndex) =>
              !nearLabel(bend) ? (
                <Pill
                  key={bendIndex}
                  kind="solid"
                  x={bend.x}
                  y={bend.y}
                  axis={axisAtBend(bendIndex)}
                  onPointerDown={(e) => startSolidDrag(bendIndex, e)}
                />
              ) : null,
            )
          : null}

        {/* Endpoint handles: shown while hovered OR selected. */}
        {active && !labelEditor.isEditing ? (
          <>
            <EndpointHandle
              x={sourceFloating ? sourcePoint.x : sourceX}
              y={sourceFloating ? sourcePoint.y : sourceY}
              floating={sourceFloating}
              hit={fullyFloating ? 16 : 10}
              onPointerDown={(e) => startEndpointDrag('source', e)}
            />
            <EndpointHandle
              x={targetFloating ? targetPoint.x : targetX}
              y={targetFloating ? targetPoint.y : targetY}
              floating={targetFloating}
              hit={fullyFloating ? 16 : 10}
              onPointerDown={(e) => startEndpointDrag('target', e)}
            />
          </>
        ) : null}
      </g>

      <ConnectionLabels
        labels={labels}
        selected={!!selected}
        labelStyle={labelStyle}
        pointAtT={pointAtT}
        editor={labelEditor}
      />
    </>
  );
}
