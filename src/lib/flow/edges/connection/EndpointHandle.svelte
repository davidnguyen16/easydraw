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
		onpointerdown?: (event: PointerEvent) => void;
	}

	let { x, y, floating = false, onpointerdown }: Props = $props();

	const COLOR = '#a6192e';
	const R = 5; // visible dot radius
	const HIT = 10; // transparent grab radius
</script>

<g class="endpoint" onpointerdown={(e) => onpointerdown?.(e)} role="presentation">
	<circle cx={x} cy={y} r={HIT} fill="transparent" />
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

<style>
	/* `move` = the 4-way arrow, signalling "drag this end to reconnect". Forced on
	   the whole group (incl. the visible dot) so the icon never reverts to the
	   arrow while the pointer is anywhere on the handle. `pointer-events: all` so
	   the transparent hit circle is reliably grabbable. */
	.endpoint,
	.endpoint * {
		cursor: move;
		pointer-events: all;
	}
</style>
