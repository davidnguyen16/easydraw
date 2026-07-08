<script lang="ts">
	import type { Axis } from './types';

	interface Props {
		kind: 'ghost' | 'solid';
		x: number;
		y: number;
		axis: Axis;
		onpointerdown?: (event: PointerEvent) => void;
	}

	let { kind, x, y, axis, onpointerdown }: Props = $props();

	// True from pointerdown until the next global pointerup. Used to keep
	// the "pressed" highlight visible for the whole drag, even after the
	// cursor leaves the pill's bounding box.
	let pressing = $state(false);

	// The pill's long edge lies ALONG the segment, so a horizontal segment
	// gets a wide pill and a vertical segment a tall pill. This visually
	// hints the perpendicular drag direction to the user.
	const isHorizontal = $derived(axis === 'h');
	const width = $derived(isHorizontal ? 26 : 14);
	const height = $derived(isHorizontal ? 14 : 26);
	const rx = $derived(Math.min(width, height) / 2);

	// Tailwind equivalent of the old scoped rules, assembled from the same
	// state (kind / axis / pressing). Arbitrary values cover the SVG-only bits
	// with no utility (pointer-events: bounding-box, transform-box: fill-box).
	const pillClass = $derived(
		[
			// Base: 1px stroke, transitions, full-rect hit area, centred transforms.
			'origin-center transition-[stroke-opacity,fill,filter] duration-[120ms] ease-[ease]',
			'[stroke-width:1] [pointer-events:bounding-box] [transform-box:fill-box]',
			// Ghost = midpoint placeholder (white fill hides the line beneath).
			// Solid = a real user bend point (maroon).
			kind === 'ghost'
				? 'fill-white stroke-[#9b9991] [stroke-opacity:0.55] hover:[stroke-opacity:1]'
				: 'cursor-move fill-mq-maroon stroke-mq-maroon',
			// Cursor mirrors the drag axis (ghost pills move perpendicular).
			kind === 'ghost' && (isHorizontal ? 'cursor-ns-resize' : 'cursor-ew-resize'),
			// Pressed: lift the pill and hold the highlight for the whole drag.
			pressing && '[filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.22))]',
			pressing && kind === 'ghost' && '[stroke-opacity:1] [stroke-width:1.5]',
			pressing && kind === 'solid' && 'fill-[#5a1220] stroke-[#5a1220]'
		]
			.filter(Boolean)
			.join(' ')
	);

	function handlePointerDown(event: PointerEvent) {
		// Stop propagation so the pointerdown never reaches the underlying
		// edge wrapper / canvas. Without this, xyflow sees the same gesture
		// as a click on the connection and tries to pan / re-grab the line.
		event.stopPropagation();
		event.preventDefault();

		pressing = true;
		const release = () => {
			pressing = false;
			window.removeEventListener('pointerup', release);
			window.removeEventListener('pointercancel', release);
		};
		window.addEventListener('pointerup', release);
		window.addEventListener('pointercancel', release);

		onpointerdown?.(event);
	}
</script>

<rect
	role="button"
	tabindex="-1"
	aria-label={kind === 'ghost' ? 'Add bend point' : 'Move bend point'}
	x={x - width / 2}
	y={y - height / 2}
	{width}
	{height}
	{rx}
	class={pillClass}
	onpointerdown={handlePointerDown}
/>
