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

/**
 * Minimum segment length to host a ghost pill.
 *
 * Tuned so a pill at a segment midpoint can't collide with the SOLID pills
 * (user bend points, drawn as 26×14 / 14×26 capsules) sitting at the segment
 * endpoints. Half the threshold (≈25 px) gives roughly the pill's own
 * half-extent plus a few pixels of breathing room.
 */
const MIN_PILL_SEGMENT_LENGTH = 50;

/**
 * Minimum distance from a ghost pill's midpoint to the source / target point.
 *
 * A long segment that *starts* at the source still gets its midpoint pulled
 * close to the endpoint if the user routes the line straight away from the
 * node; without this gate the ghost pill would sit on top of the source /
 * target endpoint square (8×8) that ConnectionEdge renders while selected.
 */
const ENDPOINT_PILL_EXCLUSION = 40;

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

    // Source / target endpoints — vertices[0] / [last] by buildVertices's
    // contract. Used below to suppress ghost pills that would otherwise sit
    // on top of the endpoint squares while the edge is selected.
    const sourcePoint = vertices[0]?.point;
    const targetPoint = vertices[vertices.length - 1]?.point;

    for (let i = 0; i < vertices.length - 1; i++) {
        const a = vertices[i];
        if (a.bendIndex !== null) bendCount++;

        const b = vertices[i + 1];
        const axis: Axis = approxEq(a.point.x, b.point.x) ? 'v' : 'h';
        const length =
            axis === 'h' ? Math.abs(b.point.x - a.point.x) : Math.abs(b.point.y - a.point.y);

        const mid = {
            x: (a.point.x + b.point.x) / 2,
            y: (a.point.y + b.point.y) / 2
        };

        // Pill is shown only when the segment is long enough AND its midpoint
        // is clear of both endpoints — kills the cluttered short-segment
        // pills and the ones that crash into the endpoint squares.
        const distToSource = sourcePoint
            ? Math.hypot(mid.x - sourcePoint.x, mid.y - sourcePoint.y)
            : Infinity;
        const distToTarget = targetPoint
            ? Math.hypot(mid.x - targetPoint.x, mid.y - targetPoint.y)
            : Infinity;

        const pillVisible =
            length >= MIN_PILL_SEGMENT_LENGTH &&
            distToSource >= ENDPOINT_PILL_EXCLUSION &&
            distToTarget >= ENDPOINT_PILL_EXCLUSION;

        segments.push({
            index: i,
            p1: a.point,
            p2: b.point,
            mid,
            axis,
            bendInsertIndex: bendCount,
            startBendIndex: a.bendIndex,
            endBendIndex: b.bendIndex,
            pillVisible
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

// ───────────────────────────────────────────────────────────────────────────
// Node-aware orthogonal router (for pristine, bend-free edges).
//
// Why this exists: xyflow's built-in SmoothStep router (which we use for the
// live connection-line preview) is NOT obstacle-aware — its own source even
// notes it only "mimics" orthogonal routing. For a connection into a handle on
// the FAR side of a node (e.g. the RIGHT handle of a node sitting to the right
// of the source), SmoothStep draws a straight run that pierces the node body.
//
// To keep the dragged preview and the released edge identical (WYSIWYG) AND
// avoid piercing, BOTH the preview component and the final edge route through
// `routeOrthogonal` below: a faithful port of xyflow's SmoothStep point logic
// (so the nice cases look unchanged), with a detour pass that bends any
// interior segment crossing the source/target node box around it.
// ───────────────────────────────────────────────────────────────────────────

/** Axis-aligned box in flow coordinates. */
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Gap (px) the path leaves a handle before turning — matches xyflow's offset. */
const STUB = 20;
/** Extra breathing room (px) kept around a node when detouring around it. */
const CLEARANCE = 14;

const HANDLE_DIR: Record<Position, Point> = {
    [Position.Left]: { x: -1, y: 0 },
    [Position.Right]: { x: 1, y: 0 },
    [Position.Top]: { x: 0, y: -1 },
    [Position.Bottom]: { x: 0, y: 1 }
};

function primaryDir(source: Point, sourcePosition: Position, target: Point): Point {
    if (sourcePosition === Position.Left || sourcePosition === Position.Right) {
        return source.x < target.x ? { x: 1, y: 0 } : { x: -1, y: 0 };
    }
    return source.y < target.y ? { x: 0, y: 1 } : { x: 0, y: -1 };
}

/**
 * Faithful port of @xyflow/system's getPoints (the engine behind
 * getSmoothStepPath). Returns the orthogonal corner polyline
 * [source, …, target] plus the natural label centre. Kept byte-for-byte in
 * spirit so bend-free edges match the SmoothStep preview the user already
 * approved.
 */
function smoothStepPoints(
    source: Point,
    sourcePosition: Position,
    target: Point,
    targetPosition: Position,
    offset = STUB,
    stepPosition = 0.5
): { points: Point[]; labelX: number; labelY: number } {
    const sourceDir = HANDLE_DIR[sourcePosition];
    const targetDir = HANDLE_DIR[targetPosition];
    const sourceGapped: Point = { x: source.x + sourceDir.x * offset, y: source.y + sourceDir.y * offset };
    const targetGapped: Point = { x: target.x + targetDir.x * offset, y: target.y + targetDir.y * offset };
    const dir = primaryDir(sourceGapped, sourcePosition, targetGapped);
    const dirAccessor: 'x' | 'y' = dir.x !== 0 ? 'x' : 'y';
    const currDir = dir[dirAccessor];

    let points: Point[] = [];
    let centerX = 0;
    let centerY = 0;
    const sourceGapOffset = { x: 0, y: 0 };
    const targetGapOffset = { x: 0, y: 0 };

    if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
        if (dirAccessor === 'x') {
            centerX = sourceGapped.x + (targetGapped.x - sourceGapped.x) * stepPosition;
            centerY = (sourceGapped.y + targetGapped.y) / 2;
        } else {
            centerX = (sourceGapped.x + targetGapped.x) / 2;
            centerY = sourceGapped.y + (targetGapped.y - sourceGapped.y) * stepPosition;
        }
        const verticalSplit: Point[] = [
            { x: centerX, y: sourceGapped.y },
            { x: centerX, y: targetGapped.y }
        ];
        const horizontalSplit: Point[] = [
            { x: sourceGapped.x, y: centerY },
            { x: targetGapped.x, y: centerY }
        ];
        if (sourceDir[dirAccessor] === currDir) {
            points = dirAccessor === 'x' ? verticalSplit : horizontalSplit;
        } else {
            points = dirAccessor === 'x' ? horizontalSplit : verticalSplit;
        }
    } else {
        const sourceTarget: Point[] = [{ x: sourceGapped.x, y: targetGapped.y }];
        const targetSource: Point[] = [{ x: targetGapped.x, y: sourceGapped.y }];
        if (dirAccessor === 'x') {
            points = sourceDir.x === currDir ? targetSource : sourceTarget;
        } else {
            points = sourceDir.y === currDir ? sourceTarget : targetSource;
        }

        if (sourcePosition === targetPosition) {
            const diff = Math.abs(source[dirAccessor] - target[dirAccessor]);
            if (diff <= offset) {
                const gapOffset = Math.min(offset - 1, offset - diff);
                if (sourceDir[dirAccessor] === currDir) {
                    sourceGapOffset[dirAccessor] =
                        (sourceGapped[dirAccessor] > source[dirAccessor] ? -1 : 1) * gapOffset;
                } else {
                    targetGapOffset[dirAccessor] =
                        (targetGapped[dirAccessor] > target[dirAccessor] ? -1 : 1) * gapOffset;
                }
            }
        }

        if (sourcePosition !== targetPosition) {
            const opp: 'x' | 'y' = dirAccessor === 'x' ? 'y' : 'x';
            const isSameDir = sourceDir[dirAccessor] === targetDir[opp];
            const sourceGtTargetOppo = sourceGapped[opp] > targetGapped[opp];
            const sourceLtTargetOppo = sourceGapped[opp] < targetGapped[opp];
            const flip =
                (sourceDir[dirAccessor] === 1 &&
                    ((!isSameDir && sourceGtTargetOppo) || (isSameDir && sourceLtTargetOppo))) ||
                (sourceDir[dirAccessor] !== 1 &&
                    ((!isSameDir && sourceLtTargetOppo) || (isSameDir && sourceGtTargetOppo)));
            if (flip) {
                points = dirAccessor === 'x' ? sourceTarget : targetSource;
            }
        }

        const sgp: Point = { x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y };
        const tgp: Point = { x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y };
        const maxXDistance = Math.max(Math.abs(sgp.x - points[0].x), Math.abs(tgp.x - points[0].x));
        const maxYDistance = Math.max(Math.abs(sgp.y - points[0].y), Math.abs(tgp.y - points[0].y));
        if (maxXDistance >= maxYDistance) {
            centerX = (sgp.x + tgp.x) / 2;
            centerY = points[0].y;
        } else {
            centerX = points[0].x;
            centerY = (sgp.y + tgp.y) / 2;
        }
    }

    const pathPoints: Point[] = [
        source,
        { x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y },
        ...points,
        { x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y },
        target
    ];

    return { points: pathPoints, labelX: centerX, labelY: centerY };
}

/** Inflated-rect edges. */
type Bounds = { x1: number; y1: number; x2: number; y2: number };

function inflate(rect: Rect, by: number): Bounds {
    return {
        x1: rect.x - by,
        y1: rect.y - by,
        x2: rect.x + rect.width + by,
        y2: rect.y + rect.height + by
    };
}

/** True when the axis-aligned segment a→b passes through the interior of `b`ounds. */
function segmentCrossesBounds(a: Point, b: Point, r: Bounds): boolean {
    if (approxEq(a.y, b.y)) {
        const y = a.y;
        if (y <= r.y1 || y >= r.y2) return false;
        const lo = Math.min(a.x, b.x);
        const hi = Math.max(a.x, b.x);
        return lo < r.x2 && hi > r.x1;
    }
    if (approxEq(a.x, b.x)) {
        const x = a.x;
        if (x <= r.x1 || x >= r.x2) return false;
        const lo = Math.min(a.y, b.y);
        const hi = Math.max(a.y, b.y);
        return lo < r.y2 && hi > r.y1;
    }
    return false;
}

/**
 * Detour points (after `a`, up to and including `b`) that route around `r`.
 *
 * `preferTop` / `preferLeft` decide which way the bend wraps so the result
 * matches the design rule: a path to a far-side handle arcs to the side the
 * SOURCE sits on — source above target → over the top; source below → under
 * the bottom (and the left/right analogue for vertical runs).
 */
function detour(
    a: Point,
    b: Point,
    r: Bounds,
    preferTop: boolean,
    preferLeft: boolean
): Point[] {
    if (!segmentCrossesBounds(a, b, r)) return [b];
    if (approxEq(a.y, b.y)) {
        // Horizontal run pierces the box → bend over the top or under the bottom.
        const dy = preferTop ? r.y1 : r.y2;
        return [{ x: a.x, y: dy }, { x: b.x, y: dy }, b];
    }
    // Vertical run pierces the box → bend around the left or right side.
    const dx = preferLeft ? r.x1 : r.x2;
    return [{ x: dx, y: a.y }, { x: dx, y: b.y }, b];
}

/**
 * Routes the interior segments of `points` around `rect`, leaving the first
 * and last (handle stub) segments untouched so the path still plugs straight
 * into each handle. MUST run on the raw (un-simplified) point list so the
 * handle stubs are still their own segments — otherwise a collinear stub gets
 * merged into the long run and is mistaken for a stub, skipping the detour.
 */
function avoidRect(
    points: Point[],
    rect: Rect | null,
    preferTop: boolean,
    preferLeft: boolean
): Point[] {
    if (!rect || points.length < 4) return points;
    const r = inflate(rect, CLEARANCE);
    const out: Point[] = [points[0], points[1]];
    for (let i = 2; i <= points.length - 2; i++) {
        out.push(...detour(out[out.length - 1], points[i], r, preferTop, preferLeft));
    }
    out.push(points[points.length - 1]);
    return out;
}

/** Drops duplicate and collinear points so the path/segments stay clean. */
function simplifyPoints(points: Point[]): Point[] {
    const dedup: Point[] = [];
    for (const p of points) {
        const prev = dedup[dedup.length - 1];
        if (!prev || !approxEq(prev.x, p.x) || !approxEq(prev.y, p.y)) dedup.push(p);
    }
    if (dedup.length <= 2) return dedup;
    const out: Point[] = [dedup[0]];
    for (let i = 1; i < dedup.length - 1; i++) {
        const a = out[out.length - 1];
        const b = dedup[i];
        const c = dedup[i + 1];
        const collinear =
            (approxEq(a.x, b.x) && approxEq(b.x, c.x)) ||
            (approxEq(a.y, b.y) && approxEq(b.y, c.y));
        if (!collinear) out.push(b);
    }
    out.push(dedup[dedup.length - 1]);
    return out;
}

/**
 * The side of `to` that faces `from`. Used to give a FLOATING endpoint (one
 * not attached to a real handle — a free wire end / pointer during a drag) a
 * deterministic direction so the route is identical whether it's computed for
 * the live preview (target = pointer, no node) or the released edge (target =
 * the anchor that lands at the same spot).
 */
function facingPosition(from: Point, to: Point): Position {
    const dx = from.x - to.x;
    const dy = from.y - to.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0 ? Position.Right : Position.Left;
    }
    return dy >= 0 ? Position.Bottom : Position.Top;
}

export interface RouteOptions {
    source: Point;
    sourcePosition: Position;
    sourceRect: Rect | null;
    target: Point;
    targetPosition: Position;
    targetRect: Rect | null;
    /**
     * Mark an endpoint as FLOATING (free wire end / drag pointer, not a real
     * handle). Its `*Position` is then ignored and replaced with a synthetic
     * one facing the other end — the only way the preview (pointer, no node)
     * and the released edge (anchor) can resolve to the exact same path.
     * Floating endpoints also shouldn't avoid their own anchor box, so pass
     * their `*Rect` as null.
     */
    sourceFloating?: boolean;
    targetFloating?: boolean;
}

/**
 * Node-aware orthogonal route for a bend-free edge. Produces the SmoothStep
 * corner polyline, then bends any interior segment that would cross the source
 * or target node around it. Returns [source, …corners, target].
 */
export function routeOrthogonal(opts: RouteOptions): Point[] {
    let { source, sourcePosition, sourceRect, target, targetPosition, targetRect } = opts;

    // Floating ends have no handle direction; synthesise one facing the other
    // end so preview and released edge agree (see facingPosition).
    if (opts.sourceFloating) sourcePosition = facingPosition(target, source);
    if (opts.targetFloating) targetPosition = facingPosition(source, target);

    // Canonical orientation (top-left endpoint first) so the route is
    // DIRECTION-INDEPENDENT. This is what makes the released edge match the
    // drag preview in every case: when reconnecting the SOURCE end,
    // EdgeReconnectAnchor computes the preview from the fixed TARGET back to
    // the pointer (reversed), and SmoothStep isn't perfectly symmetric — so
    // without canonicalising, preview and final would diverge. The rendered
    // line is undirected, so reordering the points is purely visual-neutral.
    const swap =
        source.x > target.x || (approxEq(source.x, target.x) && source.y > target.y);
    if (swap) {
        [source, target] = [target, source];
        [sourcePosition, targetPosition] = [targetPosition, sourcePosition];
        [sourceRect, targetRect] = [targetRect, sourceRect];
    }

    const { points } = smoothStepPoints(source, sourcePosition, target, targetPosition);

    // Wrap side rule (now stable under canonical order): arc to the side the
    // canonical-first endpoint sits on — above → over the top, below → under
    // the bottom; left/right analogue for vertical runs.
    const preferTop = source.y <= target.y;
    const preferLeft = source.x <= target.x;

    // Avoidance MUST precede simplification (see avoidRect): run it on the raw
    // points so handle stubs stay distinct segments, then tidy the result.
    let routed = avoidRect(points, targetRect, preferTop, preferLeft);
    routed = avoidRect(routed, sourceRect, preferTop, preferLeft);
    return simplifyPoints(routed);
}

/** Midpoint of the longest segment of a polyline — used to place the "add bend" handle. */
export function longestSegmentMidpoint(points: Point[]): Point {
    let best = { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0 };
    let bestLen = -1;
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len > bestLen) {
            bestLen = len;
            best = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        }
    }
    return best;
}
