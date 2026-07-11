<script lang="ts">
	/**
	 * Draw.io-style canvas scrollbars.
	 *
	 * Compares the world-space bounding box of all nodes against the visible
	 * world rect (derived from the xyflow viewport transform). A bar only
	 * appears on an axis when some node sticks out of view on that axis;
	 * dragging its thumb pans the viewport. Both hidden = everything visible.
	 */
	import { useSvelteFlow, type Node, type Viewport } from '@xyflow/svelte';
	import { ANCHOR_NODE_TYPE } from '$lib/flow/nodes/anchor/anchor';

	interface Props {
		nodes: Node[];
		viewport: Viewport;
		/** canvas-shell client size (the visible canvas area, in px). */
		width: number;
		height: number;
	}

	let { nodes, viewport, width, height }: Props = $props();

	const flow = useSvelteFlow();

	const MIN_THUMB = 28; // px — keep the thumb grabbable at extreme ratios
	// Track insets, must match the CSS classes below: 8px near corner-free
	// edge (left-2 / top-2), 24px at the shared corner (right-6 / bottom-6)
	// so the two bars never overlap each other.
	const TRACK_INSET = 8 + 24;

	// World-space bbox of the user's nodes (anchors are internal dots — skip).
	const content = $derived.by(() => {
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		let any = false;
		for (const n of nodes) {
			if (n.type === ANCHOR_NODE_TYPE) continue;
			const w = (n.measured?.width ?? (n as { width?: number }).width ?? 0) as number;
			const h = (n.measured?.height ?? (n as { height?: number }).height ?? 0) as number;
			minX = Math.min(minX, n.position.x);
			minY = Math.min(minY, n.position.y);
			maxX = Math.max(maxX, n.position.x + w);
			maxY = Math.max(maxY, n.position.y + h);
			any = true;
		}
		return any ? { minX, minY, maxX, maxY } : null;
	});

	// Visible world rect: screen = world * zoom + viewport offset, inverted.
	const visible = $derived({
		minX: -viewport.x / viewport.zoom,
		minY: -viewport.y / viewport.zoom,
		maxX: (-viewport.x + width) / viewport.zoom,
		maxY: (-viewport.y + height) / viewport.zoom
	});

	interface BarModel {
		thumbPx: number;
		thumbOffset: number;
		trackPx: number;
		maxScrollWorld: number;
	}

	// Standard scrollbar math over the union of content and view: thumb size ∝
	// visible share of the union, thumb offset ∝ how far the view is scrolled.
	function barModel(
		cMin: number,
		cMax: number,
		vMin: number,
		vMax: number,
		trackPx: number
	): BarModel | null {
		if (trackPx <= MIN_THUMB) return null;
		if (cMin >= vMin && cMax <= vMax) return null; // nothing sticks out
		const min = Math.min(cMin, vMin);
		const max = Math.max(cMax, vMax);
		const range = max - min;
		const visSpan = vMax - vMin;
		const maxScrollWorld = range - visSpan;
		if (maxScrollWorld <= 0 || range <= 0) return null;
		const thumbPx = Math.max((visSpan / range) * trackPx, MIN_THUMB);
		const scrollFrac = (vMin - min) / maxScrollWorld;
		const thumbOffset = scrollFrac * (trackPx - thumbPx);
		return { thumbPx, thumbOffset, trackPx, maxScrollWorld };
	}

	const hBar = $derived(
		content ? barModel(content.minX, content.maxX, visible.minX, visible.maxX, width - TRACK_INSET) : null
	);
	const vBar = $derived(
		content ? barModel(content.minY, content.maxY, visible.minY, visible.maxY, height - TRACK_INSET) : null
	);

	// Thumb drag → pan. Mapping: full thumb travel = full world scroll range.
	function startDrag(axis: 'h' | 'v', e: PointerEvent) {
		const bar = axis === 'h' ? hBar : vBar;
		if (!bar) return;
		e.preventDefault();
		e.stopPropagation();

		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);

		const start = axis === 'h' ? e.clientX : e.clientY;
		const startVp = { ...viewport };
		const scrollablePx = bar.trackPx - bar.thumbPx;

		const onMove = (ev: PointerEvent) => {
			if (scrollablePx <= 0) return;
			const delta = (axis === 'h' ? ev.clientX : ev.clientY) - start;
			const dWorld = (delta / scrollablePx) * bar.maxScrollWorld;
			flow.setViewport({
				x: startVp.x - (axis === 'h' ? dWorld * startVp.zoom : 0),
				y: startVp.y - (axis === 'v' ? dWorld * startVp.zoom : 0),
				zoom: startVp.zoom
			});
		};
		const onUp = () => {
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerup', onUp);
		};
		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerup', onUp);
	}
</script>

{#if hBar}
	<div class="pointer-events-none absolute right-6 bottom-1 left-2 z-30 h-2">
		<button
			type="button"
			aria-label="Scroll canvas horizontally"
			class="pointer-events-auto absolute top-0 h-full cursor-grab rounded-full border-none
				bg-ink/30 p-0 transition-colors duration-100 hover:bg-ink/50 active:cursor-grabbing"
			style="left: {hBar.thumbOffset}px; width: {hBar.thumbPx}px"
			onpointerdown={(e) => startDrag('h', e)}
		></button>
	</div>
{/if}

{#if vBar}
	<div class="pointer-events-none absolute top-2 right-1 bottom-6 z-30 w-2">
		<button
			type="button"
			aria-label="Scroll canvas vertically"
			class="pointer-events-auto absolute left-0 w-full cursor-grab rounded-full border-none
				bg-ink/30 p-0 transition-colors duration-100 hover:bg-ink/50 active:cursor-grabbing"
			style="top: {vBar.thumbOffset}px; height: {vBar.thumbPx}px"
			onpointerdown={(e) => startDrag('v', e)}
		></button>
	</div>
{/if}
