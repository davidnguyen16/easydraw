<script lang="ts">
	/**
	 * Live connection-line preview shown while the user drags out a new edge.
	 *
	 * It renders with the SAME node-aware router (`routeOrthogonal`) the final
	 * ConnectionEdge uses, so "what you drag is what you get" (WYSIWYG) AND the
	 * preview bends around the target node instead of cutting through it. When
	 * the pointer is over a node's handle, `toNode` is set and we avoid it;
	 * over empty canvas it routes straight to the pointer.
	 *
	 * xyflow renders a custom connectionLineComponent with no props — the live
	 * connection state comes from the `useConnection()` hook instead.
	 */
	import { Position, useConnection } from '@xyflow/svelte';
	import { buildSvgPath, routeOrthogonal, type Rect } from './routing';

	const CORNER_RADIUS = 8;
	// Keep in sync with ConnectionEdge.OUTLINE_INSET: some shapes' dots sit on the
	// bbox edge, but the visible outline is inset from there on a side, so push the
	// wire end in to touch it (the dot stays put). +4px so the tip crosses the
	// edge. Triangle side ≈ 25.5% in; parallelogram side ≈ 10.5% in; document
	// bottom ≈ 18% up.
	const ENDPOINT_INSET = 4;
	type OutlineInset = Partial<Record<Position, number>>;
	const OUTLINE_INSET: Record<string, OutlineInset> = {
		TriangleNode: { [Position.Left]: 0.255, [Position.Right]: 0.255 },
		ParallelogramNode: { [Position.Left]: 0.105, [Position.Right]: 0.105 },
		// Flowchart Data = the same parallelogram slant under a different id.
		DataNode: { [Position.Left]: 0.105, [Position.Right]: 0.105 },
		DocumentNode: { [Position.Bottom]: 0.18 },
		OrthogonalTriangleNode: { [Position.Top]: 0.49, [Position.Right]: 0.49 },
		StarNode: { [Position.Left]: 0.17, [Position.Right]: 0.17, [Position.Bottom]: 0.25 },
		HalfCircleNode: { [Position.Left]: 0.076, [Position.Right]: 0.076 },
		ArrowRightNode: { [Position.Top]: 0.29, [Position.Bottom]: 0.29 },
		// Pentagon: side edges at mid-height are ~4.7% in (apex + base touch).
		PentagonNode: { [Position.Left]: 0.047, [Position.Right]: 0.047 },
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
		},
		// Trapezoid L/R: slant at mid-height is ~12% in (25,1 75,1 99,99 1,99).
		TrapezoidNode: { [Position.Left]: 0.12, [Position.Right]: 0.12 },
		// Chevron: left notch vertex sits at x=24%; the right tip touches.
		ChevronNode: { [Position.Left]: 0.24 },
		// Drop: the flank curves at mid-height sit ~3.5% inside the bbox sides.
		DropNode: { [Position.Left]: 0.035, [Position.Right]: 0.035 }
	};

	const connection = useConnection();

	// Inset fraction for a node's connection end at `position`, or 0 when this end
	// doesn't inset. Also serves as the "is an inset outline end" test (ratio > 0),
	// used to skip self-avoidance for that node below.
	function outlineInsetRatio(node: unknown, position: Position | null | undefined): number {
		if (position == null) return 0;
		const type = (node as { type?: string } | null | undefined)?.type;
		return (type && OUTLINE_INSET[type]?.[position]) || 0;
	}

	// Mirrors ConnectionEdge.insetForEnd for inset outline ends, so the live drag
	// preview reaches the outline exactly like the released edge will.
	function insetSideEnd(
		node: unknown,
		p: { x: number; y: number },
		position: Position | null | undefined
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

	const pathD = $derived.by(() => {
		const c = connection.current;
		if (!c.inProgress) return '';
		// No node under the pointer → the end is FLOATING. Flag it so this
		// preview resolves to the exact same path the released edge will draw
		// once an anchor is dropped at this spot.
		const targetFloating = !c.toNode;
		// An inset-outline end (triangle/parallelogram sides, document bottom) is
		// inset into its own bbox in an empty region, so skip avoiding that node's
		// own rect — otherwise the leaving stub gets bent around the shape even
		// though it only crosses that empty region, not the body.
		const points = routeOrthogonal({
			source: insetSideEnd(c.fromNode, c.from, c.fromPosition),
			sourcePosition: c.fromPosition,
			sourceRect: outlineInsetRatio(c.fromNode, c.fromPosition) > 0 ? null : rectOf(c.fromNode),
			target: targetFloating ? c.to : insetSideEnd(c.toNode, c.to, c.toPosition),
			targetPosition: c.toPosition,
			targetRect:
				targetFloating || outlineInsetRatio(c.toNode, c.toPosition) > 0
					? null
					: rectOf(c.toNode),
			targetFloating
		});
		return buildSvgPath(
			points.map((point) => ({ point, bendIndex: null as number | null })),
			CORNER_RADIUS
		);
	});
</script>

<path
	d={pathD}
	fill="none"
	class="svelte-flow__connection-path"
	style="stroke: #A6192E; stroke-width: 1.5px;"
	stroke-linecap="round"
	stroke-linejoin="round"
/>
