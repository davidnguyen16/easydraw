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

/** Endpoint marker drawn at the start / end of a connection. */
export type MarkerKind =
	| 'none'
	// Arrows
	| 'arrow'
	| 'triangle'
	| 'triangle-open'
	| 'triangle-sharp'
	| 'half-arrow-up'
	| 'half-arrow-down'
	| 'triangle-double'
	| 'triangle-open-double'
	| 'arrow-double'
	| 'arrow-cross'
	| 'arrow-cross-double'
	// Basic shapes
	| 'circle'
	| 'circle-open'
	| 'circle-cross'
	| 'circle-small'
	| 'circle-open-small'
	| 'bar-circle'
	| 'bar-circle-open'
	| 'bar-double-circle'
	| 'bar-double-circle-open'
	| 'bar-triple-circle'
	| 'bar-triple-circle-open'
	| 'diamond-circle'
	| 'diamond-circle-open'
	| 'square'
	| 'square-open'
	| 'square-small'
	| 'square-open-small'
	| 'diamond'
	| 'diamond-open'
	| 'diamond-open-small'
	| 'diamond-open-wide'
	// Ticks
	| 'bar'
	| 'bar-double'
	| 'slash'
	// ERD cardinality
	| 'crowfoot'
	| 'circle-crowfoot'
	| 'bar-crowfoot'
	| 'circle-bar';

/** Stroke pattern of the line. */
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted';

/**
 * Path algorithm.
 *   'orthogonal' — the default node-aware right-angle router (+ user bends).
 *   'straight'   — a direct line between the endpoints (no bends).
 *   'curved'     — a cubic bezier leaving each handle along its direction.
 */
export type EdgeRouting = 'straight' | 'orthogonal' | 'curved';

/** One text label pinned to a point along the edge. */
export interface ConnectionLabel {
	/** Stable id (used as the Svelte key and for edit/remove targeting). */
	id: string;
	/** Position along the path as a fraction of total length, in [0, 1]. */
	t: number;
	/** Text content. Empty labels are pruned on commit. */
	text: string;
}

export interface ConnectionEdgeData {
	/** Ordered bend points the user has dropped on this edge. */
	bendPoints?: Point[];
	/**
	 * Text labels placed ALONG the edge (Lucidchart-style). Multiple are
	 * allowed; each masks the strip of line it sits on so the line shows a
	 * clean gap between consecutive labels.
	 */
	labels?: ConnectionLabel[];
	/**
	 * Text style applied to ALL labels on this edge. Driven by the toolbar
	 * font / size / B / I / U / colour controls when the edge is selected,
	 * mirroring the per-node text-style fields. Omitted fields fall back to
	 * the default connection-label look.
	 */
	fontFamily?: string;
	fontSize?: number;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	textColor?: string;
	/**
	 * Line appearance, driven by ConnectionStylePanel while the edge is
	 * selected. Every field is optional — omitted fields render the default
	 * connection look, so pre-existing edges are unchanged.
	 */
	markerStart?: MarkerKind;
	markerEnd?: MarkerKind;
	lineStyle?: EdgeLineStyle;
	routing?: EdgeRouting;
	strokeWidth?: number;
	strokeColor?: string;
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
