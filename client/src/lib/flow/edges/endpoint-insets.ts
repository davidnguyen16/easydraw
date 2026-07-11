import { Position } from '@xyflow/svelte';
import { MARKER_GLYPHS } from './marker-glyphs';
import type { Rect } from './routing';
import type { MarkerKind, Point } from './types';

export const ENDPOINT_INSET = 4;

type OutlineInset = Partial<Record<Position, number>>;

/*
 * Shapes whose connection dots sit on the bbox edge while the visible outline
 * is inset from that edge. The ratio is multiplied by node width/height to
 * push the wire endpoint onto the visual outline.
 */
const OUTLINE_INSET: Record<string, OutlineInset> = {
	TriangleNode: { [Position.Left]: 0.255, [Position.Right]: 0.255 },
	ParallelogramNode: { [Position.Left]: 0.105, [Position.Right]: 0.105 },
	DataNode: { [Position.Left]: 0.105, [Position.Right]: 0.105 },
	DocumentNode: { [Position.Bottom]: 0.18 },
	OrthogonalTriangleNode: { [Position.Top]: 0.49, [Position.Right]: 0.49 },
	StarNode: { [Position.Left]: 0.17, [Position.Right]: 0.17, [Position.Bottom]: 0.25 },
	HalfCircleNode: { [Position.Left]: 0.076, [Position.Right]: 0.076 },
	PentagonNode: { [Position.Left]: 0.047, [Position.Right]: 0.047 },
	TrapezoidNode: { [Position.Left]: 0.12, [Position.Right]: 0.12 },
	ChevronNode: { [Position.Left]: 0.24 },
	DropNode: { [Position.Left]: 0.035, [Position.Right]: 0.035 },
	ArrowRightNode: { [Position.Top]: 0.29, [Position.Bottom]: 0.29 },
	ArrowLeftNode: { [Position.Top]: 0.29, [Position.Bottom]: 0.29 },
	ArrowUpNode: { [Position.Left]: 0.29, [Position.Right]: 0.29 },
	ArrowDownNode: { [Position.Left]: 0.29, [Position.Right]: 0.29 },
	NotchedArrowNode: { [Position.Top]: 0.29, [Position.Bottom]: 0.29, [Position.Left]: 0.14 },
	TwoWayArrowNode: { [Position.Top]: 0.29, [Position.Bottom]: 0.29 },
	UTurnArrowNode: { [Position.Right]: 0.24, [Position.Bottom]: 0.2 },
	BendArrowNode: { [Position.Left]: 0.48, [Position.Right]: 0.24, [Position.Bottom]: 0.14 },
	BendDoubleArrowNode: {
		[Position.Top]: 0.13,
		[Position.Left]: 0.48,
		[Position.Right]: 0.24,
		[Position.Bottom]: 0.14
	}
};

const NO_TOUCH_TYPES = new Set(['ActorNode', 'TextNode']);
const MARKER_TOUCH = 2.5;

export function outlineInsetRatioForType(type: string | undefined, position: Position): number {
	return (type && OUTLINE_INSET[type]?.[position]) || 0;
}

function insetIntoNode(point: Point, position: Position, amount = ENDPOINT_INSET): Point {
	switch (position) {
		case Position.Top:
			return { x: point.x, y: point.y + amount };
		case Position.Right:
			return { x: point.x - amount, y: point.y };
		case Position.Bottom:
			return { x: point.x, y: point.y - amount };
		case Position.Left:
			return { x: point.x + amount, y: point.y };
		default:
			return point;
	}
}

function markerBury(rect: Rect | null, position: Position): number {
	const dim = rect
		? position === Position.Left || position === Position.Right
			? rect.width
			: rect.height
		: 0;
	return dim * 0.01 + 2;
}

export function insetForEnd({
	nodeType,
	point,
	position,
	marker = 'none',
	rect
}: {
	nodeType: string | undefined;
	point: Point;
	position: Position;
	marker?: MarkerKind;
	rect: Rect | null;
}): Point {
	const glyph = marker === 'none' ? null : MARKER_GLYPHS[marker];
	const ratio = outlineInsetRatioForType(nodeType, position);

	if (ratio > 0 && rect) {
		const cross = glyph ? (glyph.flush ? 0 : MARKER_TOUCH) : ENDPOINT_INSET;
		const dx = rect.width * ratio + cross;
		const dy = rect.height * ratio + cross;
		if (position === Position.Left) return { x: point.x + dx, y: point.y };
		if (position === Position.Right) return { x: point.x - dx, y: point.y };
		if (position === Position.Top) return { x: point.x, y: point.y + dy };
		if (position === Position.Bottom) return { x: point.x, y: point.y - dy };
	}

	if (glyph) {
		if ((nodeType && NO_TOUCH_TYPES.has(nodeType)) || glyph.flush) return point;
		return insetIntoNode(point, position, markerBury(rect, position));
	}

	return insetIntoNode(point, position);
}
