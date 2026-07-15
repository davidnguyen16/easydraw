<script lang="ts">
	/**
	 * Draggable endpoint handle on a connection (draw.io / drawnode style).
	 *
	 * Two concentric circles at the wire end:
	 *  - a larger TRANSPARENT circle = a generous hit area so the small dot is
	 *    easy to grab;
	 *  - a small VISIBLE circle whose look encodes attachment:
	 *      • attached to a node → solid filled dot,
	 *      • floating (free end) → white dot with a DASHED ring,
	 *    so you can tell at a glance whether an end is pinned to a shape.
	 *
	 * Purely presentational + a pointerdown hook: the drag itself (follow the
	 * cursor, snap to a nearby handle, or drop floating) lives in ConnectionEdge,
	 * mirroring how Pill delegates its drag upward.
	 */
	interface Props {
		x: number;
		y: number;
		/** True when this end is a free/floating wire end (not pinned to a node). */
		floating?: boolean;
		/**
		 * Transparent grab radius. Fully-floating edges pass a larger one so the
		 * endpoint wins the overlap with the line's own whole-move grab strip —
		 * the 4-way cursor zone and the "this drag reshapes" zone stay identical.
		 */
		hit?: number;
		onpointerdown?: (event: PointerEvent) => void;
	}

	let { x, y, floating = false, hit = 10, onpointerdown }: Props = $props();

	const COLOR = '#a6192e';
	const R = 5; // visible dot radius
</script>

<!-- `cursor-move` + `pointer-events:all` forced on the group AND every child so the
     4-way "drag to reconnect" cursor never reverts over the visible dot, and the
     transparent hit circle stays reliably grabbable. -->
<g
	class="cursor-move [pointer-events:all] [&_*]:cursor-move [&_*]:[pointer-events:all]"
	onpointerdown={(e) => onpointerdown?.(e)}
	role="presentation"
>
	<circle cx={x} cy={y} r={hit} fill="transparent" />
	<circle
		cx={x}
		cy={y}
		r={R}
		fill={floating ? '#ffffff' : COLOR}
		stroke={floating ? COLOR : '#ffffff'}
		stroke-width="1.5"
		stroke-dasharray={floating ? '2 2' : undefined}
	/>
</g>

