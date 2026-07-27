<script lang="ts">
	/**
	 * Draw.io-style bounded canvas panning + scrollbars.
	 *
	 * One finite world-space domain drives both xyflow's translate extent and
	 * the two custom scrollbar thumbs. The domain is the initial canvas area
	 * unioned with all diagram content, plus a small screen-space work margin.
	 * It grows when content moves outward and shrinks when content is removed.
	 */
	import { onMount, untrack } from 'svelte';
	import {
		useStore,
		useSvelteFlow,
		type CoordinateExtent,
		type Edge,
		type Node,
		type Viewport
	} from '@xyflow/svelte';
	import type { CanvasNavigationController } from '$lib/flow/canvas-navigation';

	interface Props {
		nodes: Node[];
		edges: Edge[];
		/** canvas-shell client size (the visible canvas area, in px). */
		width: number;
		height: number;
		/** Screen-space overlays that cover the canvas from either side. */
		leftInset?: number;
		rightInset?: number;
		onNavigationReady?: (navigation: CanvasNavigationController | null) => void;
		onNavigationStart?: () => void;
	}

	let {
		nodes,
		edges,
		width,
		height,
		leftInset = 0,
		rightInset = 0,
		onNavigationReady,
		onNavigationStart
	}: Props = $props();

	const flow = useSvelteFlow();
	const store = useStore();
	const zoom = $derived(Math.max(store.viewport.zoom, 0.01));

	const MIN_THUMB = 28;
	const TRACK_INSET = 8 + 24;
	const START_PADDING_PX = 160;
	const END_PADDING_PX = 240;
	const VIEWPORT_EPSILON = 0.25;
	const MIN_USABLE_VIEWPORT_PX = 1;

	interface WorldBounds {
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
	}

	interface HorizontalViewportBounds {
		left: number;
		right: number;
		rightEdge: number;
		width: number;
	}

	function clamp(value: number, min: number, max: number) {
		return Math.min(Math.max(value, min), max);
	}

	function nonNegativeFinite(value: number) {
		return Number.isFinite(value) ? Math.max(0, value) : 0;
	}

	// Sidebar and style panels are absolutely positioned over SvelteFlow, so
	// clientWidth alone overstates what the user can actually see. Preserve the
	// exact insets while they fit. The proportional fallback only applies when
	// overlays physically overlap on an exceptionally narrow viewport; it keeps
	// all navigation maths finite and hides the unusable horizontal track.
	const horizontalViewport = $derived.by((): HorizontalViewportBounds => {
		const canvasWidth = nonNegativeFinite(width);
		const requestedLeft = nonNegativeFinite(leftInset);
		const requestedRight = nonNegativeFinite(rightInset);
		const maxCombinedInset = Math.max(0, canvasWidth - MIN_USABLE_VIEWPORT_PX);
		const requestedCombinedInset = requestedLeft + requestedRight;
		const insetScale =
			requestedCombinedInset > maxCombinedInset && requestedCombinedInset > 0
				? maxCombinedInset / requestedCombinedInset
				: 1;
		const left = requestedLeft * insetScale;
		const right = requestedRight * insetScale;

		return {
			left,
			right,
			rightEdge: canvasWidth - right,
			width: Math.max(0, canvasWidth - left - right)
		};
	});

	function isFiniteBounds(bounds: WorldBounds) {
		return (
			Number.isFinite(bounds.minX) &&
			Number.isFinite(bounds.minY) &&
			Number.isFinite(bounds.maxX) &&
			Number.isFinite(bounds.maxY) &&
			bounds.maxX >= bounds.minX &&
			bounds.maxY >= bounds.minY
		);
	}

	// xyflow's bounds helper correctly handles node origins and nested/grouped
	// nodes. Bend points are added separately because a manually routed edge can
	// extend beyond every node and floating endpoint.
	const diagramBounds = $derived.by((): WorldBounds | null => {
		const visibleNodes = nodes.filter((node) => !node.hidden);
		let bounds: WorldBounds | null = null;

		if (visibleNodes.length > 0) {
			const nodeBounds = flow.getNodesBounds(visibleNodes);
			const candidate = {
				minX: nodeBounds.x,
				minY: nodeBounds.y,
				maxX: nodeBounds.x + nodeBounds.width,
				maxY: nodeBounds.y + nodeBounds.height
			};
			if (isFiniteBounds(candidate)) bounds = candidate;
		}

		for (const edge of edges) {
			if (edge.hidden) continue;
			const bendPoints = (
				edge.data as { bendPoints?: { x: number; y: number }[] } | undefined
			)?.bendPoints;

			for (const point of bendPoints ?? []) {
				if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
				if (!bounds) {
					bounds = {
						minX: point.x,
						minY: point.y,
						maxX: point.x,
						maxY: point.y
					};
					continue;
				}
				bounds.minX = Math.min(bounds.minX, point.x);
				bounds.minY = Math.min(bounds.minY, point.y);
				bounds.maxX = Math.max(bounds.maxX, point.x);
				bounds.maxY = Math.max(bounds.maxY, point.y);
			}
		}

		return bounds;
	});

	// Keep a stable "home canvas" from (0,0) through the unobscured viewport's
	// 100%-zoom size. Horizontal work padding is only added where diagram
	// content needs it, so an empty/fitting canvas does not show a meaningless
	// horizontal scrollbar. Vertical behaviour keeps the existing bounded work
	// margin. Padding is converted to world units for consistent screen spacing.
	function getScrollBounds(targetZoom: number): WorldBounds {
		const safeZoom = Math.max(targetZoom, 0.01);
		const startPadding = START_PADDING_PX / safeZoom;
		const endPadding = END_PADDING_PX / safeZoom;
		const homeWidth = horizontalViewport.width;
		const contentMinX = diagramBounds ? diagramBounds.minX - startPadding : 0;
		const contentMaxX = diagramBounds ? diagramBounds.maxX + endPadding : homeWidth;

		return {
			minX: Math.min(0, contentMinX),
			minY: Math.min(0, diagramBounds?.minY ?? 0) - startPadding,
			maxX: Math.max(homeWidth, contentMaxX),
			maxY: Math.max(height, diagramBounds?.maxY ?? 0) + endPadding
		};
	}

	const scrollBounds = $derived(getScrollBounds(zoom));

	const viewport = $derived(store.viewport);

	// Visible world rect: screen = world * zoom + viewport offset, inverted.
	const visible = $derived({
		minX: (horizontalViewport.left - viewport.x) / viewport.zoom,
		minY: -viewport.y / viewport.zoom,
		maxX: (horizontalViewport.rightEdge - viewport.x) / viewport.zoom,
		maxY: (-viewport.y + height) / viewport.zoom
	});

	// Returns the constrained screen-space translation for one axis. If the
	// finite domain is smaller than the visible span, centre it and lock panning
	// on that axis (the same behaviour as d3-zoom's extent constraint).
	function constrainViewportOffset(
		offset: number,
		zoom: number,
		screenStartPx: number,
		viewportPx: number,
		domainMin: number,
		domainMax: number
	) {
		const visibleSpan = viewportPx / zoom;
		const domainSpan = domainMax - domainMin;
		const currentStart = (screenStartPx - offset) / zoom;
		const nextStart =
			domainSpan <= visibleSpan
				? domainMin - (visibleSpan - domainSpan) / 2
				: clamp(currentStart, domainMin, domainMax - visibleSpan);

		return screenStartPx - nextStart * zoom;
	}

	function getViewportWithinBounds(
		current: Viewport,
		bounds: WorldBounds,
		horizontal: HorizontalViewportBounds
	): Viewport {
		return {
			x: constrainViewportOffset(
				current.x,
				current.zoom,
				horizontal.left,
				horizontal.width,
				bounds.minX,
				bounds.maxX
			),
			y: constrainViewportOffset(
				current.y,
				current.zoom,
				0,
				height,
				bounds.minY,
				bounds.maxY
			),
			zoom: current.zoom
		};
	}

	const navigationController: CanvasNavigationController = {
		constrainViewport(viewport) {
			return getViewportWithinBounds(
				viewport,
				getScrollBounds(viewport.zoom),
				horizontalViewport
			);
		},
		getViewportCenter() {
			return {
				x: (horizontalViewport.left + horizontalViewport.rightEdge) / 2,
				y: height / 2
			};
		}
	};

	onMount(() => {
		onNavigationReady?.(navigationController);
		return () => onNavigationReady?.(null);
	});

	function applyViewportIfChanged(current: Viewport, next: Viewport) {
		if (
			Math.abs(next.x - current.x) > VIEWPORT_EPSILON ||
			Math.abs(next.y - current.y) > VIEWPORT_EPSILON
		) {
			void flow.setViewport(next);
		}
	}

	interface HorizontalNavigationSnapshot {
		bounds: WorldBounds;
		viewport: HorizontalViewportBounds;
		zoom: number;
	}

	let previousHorizontalNavigation: HorizontalNavigationSnapshot | null = null;

	function horizontalGeometryChanged(
		previous: HorizontalViewportBounds,
		next: HorizontalViewportBounds
	) {
		return (
			Math.abs(previous.left - next.left) > VIEWPORT_EPSILON ||
			Math.abs(previous.right - next.right) > VIEWPORT_EPSILON ||
			Math.abs(previous.width - next.width) > VIEWPORT_EPSILON
		);
	}

	// When an overlay opens, closes, or resizes, preserve the user's horizontal
	// scroll position rather than merely checking whether the old transform is
	// still numerically legal. A normalized scroll fraction anchors the left
	// edge at 0%, the right edge at 100%, and behaves smoothly between them.
	function preserveHorizontalScrollPosition(
		current: Viewport,
		bounds: WorldBounds,
		horizontal: HorizontalViewportBounds
	): Viewport {
		const previous = previousHorizontalNavigation;
		if (!previous || !horizontalGeometryChanged(previous.viewport, horizontal)) {
			return current;
		}

		// A simultaneous programmatic zoom + panel change makes the old domain
		// and new transform incomparable. Let zoom win for that frame, then the
		// fresh snapshot below becomes the baseline for subsequent geometry.
		if (Math.abs(previous.zoom - current.zoom) > Number.EPSILON) {
			return current;
		}

		const oldVisibleSpan = previous.viewport.width / current.zoom;
		const newVisibleSpan = horizontal.width / current.zoom;
		const oldScrollableSpan = previous.bounds.maxX - previous.bounds.minX - oldVisibleSpan;
		const newScrollableSpan = bounds.maxX - bounds.minX - newVisibleSpan;
		const oldViewStart = (previous.viewport.left - current.x) / current.zoom;

		let nextViewStart: number;
		if (oldScrollableSpan > VIEWPORT_EPSILON && newScrollableSpan > VIEWPORT_EPSILON) {
			const scrollFraction = clamp(
				(oldViewStart - previous.bounds.minX) / oldScrollableSpan,
				0,
				1
			);
			nextViewStart = bounds.minX + scrollFraction * newScrollableSpan;
		} else {
			const previousWorldCenter = oldViewStart + oldVisibleSpan / 2;
			nextViewStart = previousWorldCenter - newVisibleSpan / 2;
		}

		return {
			...current,
			x: horizontal.left - nextViewStart * current.zoom
		};
	}

	// @xyflow/svelte 1.5 only reads translateExtent when its pan/zoom instance is
	// created. Update the live instance explicitly whenever content, zoom, or
	// canvas size changes. Re-clamp only when needed so node dragging remains
	// smooth while the domain grows.
	$effect(() => {
		const bounds = scrollBounds;
		const panZoom = store.panZoom;
		if (!panZoom || width <= 0 || height <= 0) return;

		const current = untrack(() => ({ ...store.viewport }));

		// xyflow/d3 constrains against the full DOM width. Extend its world
		// extent by each overlay's screen-space footprint so the resulting
		// constraint is algebraically identical to using the unobscured strip.
		const extent: CoordinateExtent = [
			[bounds.minX - horizontalViewport.left / zoom, bounds.minY],
			[bounds.maxX + horizontalViewport.right / zoom, bounds.maxY]
		];
		store.setTranslateExtent(extent);

		const positionPreserved = preserveHorizontalScrollPosition(
			current,
			bounds,
			horizontalViewport
		);
		const next = getViewportWithinBounds(positionPreserved, bounds, horizontalViewport);

		previousHorizontalNavigation = {
			bounds: { ...bounds },
			viewport: { ...horizontalViewport },
			zoom: current.zoom
		};
		applyViewportIfChanged(current, next);
	});

	// fitView and other programmatic APIs can change x/y without changing zoom,
	// and xyflow's setViewport path bypasses translateExtent. Track viewport
	// changes separately so those calls are clamped immediately. Keeping extent
	// updates in the effect above avoids reconfiguring d3 on every pan frame.
	$effect(() => {
		const current = { ...store.viewport };
		const panZoom = store.panZoom;
		if (!panZoom || width <= 0 || height <= 0) return;

		const bounds = untrack(() => scrollBounds);
		const horizontal = untrack(() => horizontalViewport);
		const next = getViewportWithinBounds(current, bounds, horizontal);
		applyViewportIfChanged(current, next);
	});

	interface BarModel {
		thumbPx: number;
		thumbOffset: number;
		trackPx: number;
		domainMin: number;
		maxScrollWorld: number;
	}

	// Standard scrollbar math over the fixed finite domain. Unlike the old
	// union(content, current view) model, this range cannot grow merely because
	// the user keeps scrolling into blank space.
	function barModel(
		domainMin: number,
		domainMax: number,
		visibleMin: number,
		visibleMax: number,
		trackPx: number
	): BarModel | null {
		if (trackPx <= MIN_THUMB) return null;

		const domainSpan = domainMax - domainMin;
		const visibleSpan = visibleMax - visibleMin;
		const maxScrollWorld = domainSpan - visibleSpan;
		if (maxScrollWorld <= VIEWPORT_EPSILON || domainSpan <= 0 || visibleSpan <= 0) {
			return null;
		}

		const thumbPx = Math.min(
			trackPx,
			Math.max((visibleSpan / domainSpan) * trackPx, MIN_THUMB)
		);
		const scrollFraction = clamp((visibleMin - domainMin) / maxScrollWorld, 0, 1);
		const thumbOffset = scrollFraction * (trackPx - thumbPx);

		return {
			thumbPx,
			thumbOffset,
			trackPx,
			domainMin,
			maxScrollWorld
		};
	}

	const hBar = $derived(
		barModel(
			scrollBounds.minX,
			scrollBounds.maxX,
			visible.minX,
			visible.maxX,
			horizontalViewport.width - TRACK_INSET
		)
	);
	const vBar = $derived(
		barModel(
			scrollBounds.minY,
			scrollBounds.maxY,
			visible.minY,
			visible.maxY,
			height - TRACK_INSET
		)
	);

	function setAxisViewport(axis: 'h' | 'v', viewStart: number, source: Viewport) {
		void flow.setViewport({
			x: axis === 'h' ? horizontalViewport.left - viewStart * source.zoom : source.x,
			y: axis === 'v' ? -viewStart * source.zoom : source.y,
			zoom: source.zoom
		});
	}

	// Thumb drag maps its clamped track position to an absolute world-space
	// scroll position. Pointer cancel/lost-capture cleanup prevents stale drag
	// listeners if the pointer leaves the window.
	function startDrag(axis: 'h' | 'v', event: PointerEvent) {
		const bar = axis === 'h' ? hBar : vBar;
		if (!bar) return;
		event.preventDefault();
		event.stopPropagation();
		onNavigationStart?.();

		const element = event.currentTarget as HTMLElement;
		element.setPointerCapture(event.pointerId);

		const pointerStart = axis === 'h' ? event.clientX : event.clientY;
		const thumbStart = bar.thumbOffset;
		const viewportStart = flow.getViewport();
		const thumbTravel = bar.trackPx - bar.thumbPx;
		let finished = false;

		const cleanup = () => {
			if (finished) return;
			finished = true;
			element.removeEventListener('pointermove', onMove);
			element.removeEventListener('pointerup', finish);
			element.removeEventListener('pointercancel', finish);
			element.removeEventListener('lostpointercapture', cleanup);
		};

		const finish = () => {
			if (element.hasPointerCapture(event.pointerId)) {
				element.releasePointerCapture(event.pointerId);
			}
			cleanup();
		};

		const onMove = (moveEvent: PointerEvent) => {
			if (thumbTravel <= 0) return;
			const pointer = axis === 'h' ? moveEvent.clientX : moveEvent.clientY;
			const thumbOffset = clamp(thumbStart + pointer - pointerStart, 0, thumbTravel);
			const viewStart = bar.domainMin + (thumbOffset / thumbTravel) * bar.maxScrollWorld;
			setAxisViewport(axis, viewStart, viewportStart);
		};

		element.addEventListener('pointermove', onMove);
		element.addEventListener('pointerup', finish);
		element.addEventListener('pointercancel', finish);
		element.addEventListener('lostpointercapture', cleanup);
	}
</script>

{#if hBar}
	<div
		class="pointer-events-none absolute bottom-1 z-30 h-2"
		style:left={`${horizontalViewport.left + 8}px`}
		style:right={`${horizontalViewport.right + 24}px`}
	>
		<button
			type="button"
			aria-label="Scroll canvas horizontally"
			class="pointer-events-auto absolute top-0 h-full touch-none cursor-grab rounded-full
				border-none bg-ink/30 p-0 transition-colors duration-100 hover:bg-ink/50
				active:cursor-grabbing"
			style="left: {hBar.thumbOffset}px; width: {hBar.thumbPx}px"
			onpointerdown={(event) => startDrag('h', event)}
		></button>
	</div>
{/if}

{#if vBar}
	<div
		class="pointer-events-none absolute top-2 bottom-6 z-30 w-2"
		style:right={`${horizontalViewport.right + 4}px`}
	>
		<button
			type="button"
			aria-label="Scroll canvas vertically"
			class="pointer-events-auto absolute left-0 w-full touch-none cursor-grab rounded-full
				border-none bg-ink/30 p-0 transition-colors duration-100 hover:bg-ink/50
				active:cursor-grabbing"
			style="top: {vBar.thumbOffset}px; height: {vBar.thumbPx}px"
			onpointerdown={(event) => startDrag('v', event)}
		></button>
	</div>
{/if}
