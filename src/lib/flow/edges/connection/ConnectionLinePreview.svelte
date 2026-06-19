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
	import { useConnection } from '@xyflow/svelte';
	import { buildSvgPath, routeOrthogonal, type Rect } from './routing';

	const CORNER_RADIUS = 8;

	const connection = useConnection();

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
		const points = routeOrthogonal({
			source: c.from,
			sourcePosition: c.fromPosition,
			sourceRect: rectOf(c.fromNode),
			target: c.to,
			targetPosition: c.toPosition,
			targetRect: targetFloating ? null : rectOf(c.toNode),
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
