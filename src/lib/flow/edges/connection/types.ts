/**
 * EasyDraw orthogonal connection edge.
 *
 * Each edge carries a list of user-defined bend points in flow coordinates.
 * The routing layer inserts auto-corners between any two consecutive
 * waypoints that aren't axis-aligned, so the visible path is always
 * orthogonal. Auto-corners are NOT user bend points — only user bend points
 * get a solid pill; auto-corners stay invisible.
 */

export type Point = { x: number; y: number };

/** Segment orientation. */
export type Axis = 'h' | 'v';

export interface ConnectionEdgeData {
    /** Ordered bend points the user has dropped on this edge. */
    bendPoints?: Point[];
    [key: string]: unknown;
}

/** One vertex along the rendered orthogonal path. */
export interface Vertex {
    point: Point;
    /**
     * Index into the original `bendPoints` array if this vertex is a user
     * bend point; null for source, target, or auto-inserted corners.
     */
    bendIndex: number | null;
}

/** One straight segment between two consecutive vertices. */
export interface Segment {
    /** Position in the segments array (also used as Svelte key). */
    index: number;
    p1: Point;
    p2: Point;
    /** Midpoint — anchor for the ghost pill. */
    mid: Point;
    /** Segment orientation. */
    axis: Axis;
    /**
     * Insertion index for a new bend point dropped on this segment.
     * Equals the count of user bend points among vertices up to and
     * including this segment's start vertex.
     */
    bendInsertIndex: number;
    /** Index of the user bend point at p1, or null. */
    startBendIndex: number | null;
    /** Index of the user bend point at p2, or null. */
    endBendIndex: number | null;
    /** Whether the segment has enough length to host a pill without overlap. */
    pillVisible: boolean;
}
