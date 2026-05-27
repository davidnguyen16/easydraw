/**
 * Routing for EasyDraw orthogonal connection edges.
 *
 * Three pure functions, kept side-effect free so the edge component can
 * cheaply re-derive on every prop change:
 *
 *   buildVertices  — walk source → bendPoints → target, inserting auto-corners
 *                    whenever two consecutive points aren't axis-aligned.
 *   buildSegments  — pair consecutive vertices into segments and pre-compute
 *                    the metadata the edge UI needs (midpoint, axis,
 *                    insertion index for a new bend, etc).
 *   buildSvgPath   — emit the SVG `d` string, rounding every corner with a
 *                    quadratic bezier so bends look like soft pipes.
 */

import { Position } from '@xyflow/svelte';
import type { Axis, Point, Segment, Vertex } from './types';

/** Tolerance for "same coordinate" comparisons (pixels). */
const EPSILON = 0.5;

/** Segments shorter than this don't render a ghost pill (would overlap neighbours). */
const MIN_PILL_SEGMENT_LENGTH = 24;

export function positionToAxis(position: Position): Axis {
    return position === Position.Left || position === Position.Right ? 'h' : 'v';
}

function approxEq(a: number, b: number): boolean {
    return Math.abs(a - b) < EPSILON;
}

export function buildVertices(
    source: Point,
    target: Point,
    sourceAxis: Axis,
    bendPoints: Point[]
): Vertex[] {
    const inputs: Vertex[] = [
        { point: source, bendIndex: null },
        ...bendPoints.map((point, i) => ({ point, bendIndex: i as number | null })),
        { point: target, bendIndex: null }
    ];

    if (inputs.length < 2) return inputs;

    const vertices: Vertex[] = [inputs[0]];
    // Direction of the segment we just walked along. The first segment must
    // leave the source along `sourceAxis` (anchored by the handle position).
    let prevAxis: Axis = sourceAxis;

    for (let i = 1; i < inputs.length; i++) {
        const prev = vertices[vertices.length - 1].point;
        const curr = inputs[i];

        if (approxEq(prev.x, curr.point.x)) {
            vertices.push(curr);
            prevAxis = 'v';
        } else if (approxEq(prev.y, curr.point.y)) {
            vertices.push(curr);
            prevAxis = 'h';
        } else {
            // Not aligned: inject an auto-corner. Continue along prevAxis so
            // each bend looks like a natural extension of the prior segment.
            const corner: Point =
                prevAxis === 'h'
                    ? { x: curr.point.x, y: prev.y }
                    : { x: prev.x, y: curr.point.y };
            vertices.push({ point: corner, bendIndex: null });
            vertices.push(curr);
            prevAxis = prevAxis === 'h' ? 'v' : 'h';
        }
    }

    return vertices;
}

export function buildSegments(vertices: Vertex[]): Segment[] {
    const segments: Segment[] = [];
    // Running count of user bend points seen so far. A new bend dropped on
    // segment K should be inserted at this index in the bendPoints array.
    let bendCount = 0;

    for (let i = 0; i < vertices.length - 1; i++) {
        const a = vertices[i];
        if (a.bendIndex !== null) bendCount++;

        const b = vertices[i + 1];
        const axis: Axis = approxEq(a.point.x, b.point.x) ? 'v' : 'h';
        const length =
            axis === 'h' ? Math.abs(b.point.x - a.point.x) : Math.abs(b.point.y - a.point.y);

        segments.push({
            index: i,
            p1: a.point,
            p2: b.point,
            mid: {
                x: (a.point.x + b.point.x) / 2,
                y: (a.point.y + b.point.y) / 2
            },
            axis,
            bendInsertIndex: bendCount,
            startBendIndex: a.bendIndex,
            endBendIndex: b.bendIndex,
            pillVisible: length >= MIN_PILL_SEGMENT_LENGTH
        });
    }

    return segments;
}

export function buildSvgPath(vertices: Vertex[], radius: number): string {
    if (vertices.length === 0) return '';
    if (vertices.length === 1) {
        const p = vertices[0].point;
        return `M ${p.x} ${p.y}`;
    }

    let d = `M ${vertices[0].point.x} ${vertices[0].point.y}`;

    for (let i = 1; i < vertices.length - 1; i++) {
        const prev = vertices[i - 1].point;
        const curr = vertices[i].point;
        const next = vertices[i + 1].point;

        const distIn = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        const distOut = Math.hypot(next.x - curr.x, next.y - curr.y);
        // Never round more than half of either adjacent segment, otherwise
        // the curve would overshoot and produce a kink.
        const r = Math.max(0, Math.min(radius, distIn / 2, distOut / 2));

        if (r < EPSILON) {
            d += ` L ${curr.x} ${curr.y}`;
            continue;
        }

        const inDx = (curr.x - prev.x) / distIn;
        const inDy = (curr.y - prev.y) / distIn;
        const outDx = (next.x - curr.x) / distOut;
        const outDy = (next.y - curr.y) / distOut;

        const beforeX = curr.x - inDx * r;
        const beforeY = curr.y - inDy * r;
        const afterX = curr.x + outDx * r;
        const afterY = curr.y + outDy * r;

        d += ` L ${beforeX} ${beforeY}`;
        d += ` Q ${curr.x} ${curr.y} ${afterX} ${afterY}`;
    }

    const last = vertices[vertices.length - 1].point;
    d += ` L ${last.x} ${last.y}`;

    return d;
}
