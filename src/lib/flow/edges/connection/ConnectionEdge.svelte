<script lang="ts">
	import {
		EdgeLabel,
		EdgeReconnectAnchor,
		Position,
		useSvelteFlow,
		type EdgeProps
	} from '@xyflow/svelte';
	import EndpointHandle from './EndpointHandle.svelte';
	import Pill from './Pill.svelte';
	import {
		buildSegments,
		buildSvgPath,
		buildVertices,
		longestSegmentMidpoint,
		positionToAxis,
		routeOrthogonal,
		type Rect
	} from './routing';
	import { ANCHOR_NODE_TYPE } from '../../nodes/anchor/anchor';
	import { nanoid } from 'nanoid';
	import type { ConnectionEdgeData, ConnectionLabel, Point, Segment } from './types';

	let {
		id,
		source,
		target,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		selected,
		data
	}: EdgeProps = $props();

	const flow = useSvelteFlow();

	// ─── Visual constants ───────────────────────────────────────────────
	const COLOR_DEFAULT = '#B4B2A9';
	const COLOR_ACTIVE = '#5F5E5A';
	const WIDTH_DEFAULT = 1.5;
	const WIDTH_ACTIVE = 2;
	const CORNER_RADIUS = 8;
	const HIT_WIDTH = 20;

	/**
	 * Pixels to push the LINE'S source/target endpoints INWARD past each
	 * shape's bbox edge.
	 *
	 * The bbox edge is where xyflow positions the handle, and it's also
	 * roughly where the shape's visible border sits. Because xyflow renders
	 * nodes ABOVE edges in z-order, a line whose tip lands exactly on the
	 * bbox edge has its last 1–2 px painted over by the border — visually,
	 * the line "stops short" of the node, leaving the gap the user sees.
	 *
	 * Pushing the line tip a few pixels INSIDE the node means the line
	 * visibly traverses the border (it crosses through, instead of stopping
	 * at it). The endpoint markers are still anchored to the original bbox
	 * edge so the marker sits exactly at the border; the marker's solid
	 * white fill hides the inset portion of the line on the selected state.
	 */
	const ENDPOINT_INSET = 4;

	let hovered = $state(false);

	// ─── Label editing (Lucidchart-style text ALONG the edge) ───────────
	// Multiple labels live on one edge, each pinned to a normalised position
	// `t` along the path. `editingId` is the label currently in the inline
	// editor (null = none). `draft` holds the in-progress text; `cancelled`
	// lets Escape leave edit mode through blur WITHOUT saving; `editingWasNew`
	// makes Escape DELETE a label that was created by this edit session.
	let editingId = $state<string | null>(null);
	let editingT = $state(0.5);
	let draft = $state('');
	let cancelled = false;
	let editingWasNew = false;

	const isEditing = $derived(editingId !== null);

	const connectionData = $derived((data ?? {}) as ConnectionEdgeData);
	const bendPoints = $derived(connectionData.bendPoints ?? []);

	/**
	 * Returns `p` shifted `ENDPOINT_INSET` px in the direction that goes
	 * AWAY from the connection (i.e. into the node). Used for the line's
	 * source / target only — the endpoint markers stay at the original
	 * point so they mark the actual border.
	 */
	function insetIntoNode(p: Point, position: Position): Point {
		switch (position) {
			case Position.Top:
				return { x: p.x, y: p.y + ENDPOINT_INSET };
			case Position.Right:
				return { x: p.x - ENDPOINT_INSET, y: p.y };
			case Position.Bottom:
				return { x: p.x, y: p.y - ENDPOINT_INSET };
			case Position.Left:
				return { x: p.x + ENDPOINT_INSET, y: p.y };
			default:
				return p;
		}
	}

	// Current rendered box of a node (handles origin/measured size), or null
	// if it isn't measured yet. Feeds the router's obstacle avoidance.
	function rectOf(nodeId: string): Rect | null {
		const node = flow.getInternalNode(nodeId);
		if (!node) return null;
		const pos = node.internals?.positionAbsolute ?? node.position;
		const width = node.measured?.width ?? (node as { width?: number }).width;
		const height = node.measured?.height ?? (node as { height?: number }).height;
		if (pos == null || width == null || height == null) return null;
		return { x: pos.x, y: pos.y, width, height };
	}

	// A connection anchor is a free wire end — treat it as FLOATING so the
	// released edge routes exactly like the drag preview (which had no node at
	// the pointer). See routeOrthogonal's floating handling.
	function isAnchor(nodeId: string): boolean {
		return flow.getInternalNode(nodeId)?.type === ANCHOR_NODE_TYPE;
	}

	const sourceFloating = $derived(isAnchor(source));
	const targetFloating = $derived(isAnchor(target));

	// Line endpoints. For a real node, shift the tip `ENDPOINT_INSET` px inward
	// so the line crosses the border instead of stopping at it. For a FLOATING
	// end (anchor) there is no border to cross — and insetting would pull the
	// tip off the wire end, breaking the match with the drag preview — so the
	// raw point is used.
	const sourcePoint = $derived(
		sourceFloating
			? { x: sourceX, y: sourceY }
			: insetIntoNode({ x: sourceX, y: sourceY }, sourcePosition)
	);
	const targetPoint = $derived(
		targetFloating
			? { x: targetX, y: targetY }
			: insetIntoNode({ x: targetX, y: targetY }, targetPosition)
	);
	const sourceAxis = $derived(positionToAxis(sourcePosition));

	const isFreeForm = $derived(bendPoints.length === 0);

	// WYSIWYG + no piercing: a pristine edge (no user bends) is routed with the
	// node-aware orthogonal router — the SAME router the live connection-line
	// preview uses — so the path you drag is the path you get, and it bends
	// around nodes instead of cutting through them. Once the user adds a bend
	// (drags the handle below), the custom waypoint router takes over.
	const routedPoints = $derived(
		routeOrthogonal({
			source: sourcePoint,
			sourcePosition,
			sourceRect: sourceFloating ? null : rectOf(source),
			sourceFloating,
			target: targetPoint,
			targetPosition,
			targetRect: targetFloating ? null : rectOf(target),
			targetFloating
		})
	);

	const vertices = $derived(
		isFreeForm
			? routedPoints.map((point) => ({ point, bendIndex: null as number | null }))
			: buildVertices(sourcePoint, targetPoint, sourceAxis, bendPoints)
	);
	const segments = $derived(buildSegments(vertices));
	const pathD = $derived(buildSvgPath(vertices, CORNER_RADIUS));

	const labels = $derived((connectionData.labels ?? []) as ConnectionLabel[]);

	// Footprint of each committed label, so bend/ghost pills can DODGE the text
	// instead of being buried under it. Text is always horizontal, so the box
	// is axis-aligned: width follows the text length, height ≈ the chip height.
	// A pill whose centre falls inside a (padded) box is suppressed.
	const LABEL_CHAR_PX = 7; // ~advance width at 13px / 600 weight
	const labelBoxes = $derived(
		labels.map((l) => {
			const c = pointAtT(l.t);
			return {
				cx: c.x,
				cy: c.y,
				halfW: Math.max(10, (l.text.length * LABEL_CHAR_PX) / 2) + 12,
				halfH: 21
			};
		})
	);
	function nearLabel(p: Point): boolean {
		return labelBoxes.some(
			(b) => Math.abs(b.cx - p.x) < b.halfW && Math.abs(b.cy - p.y) < b.halfH
		);
	}

	// ─── Path arc-length math (positions labels ALONG the line) ─────────
	// Per-segment lengths + running total, so a label's normalised position
	// `t` ∈ [0,1] can be mapped to a flow point and back. Computed on the
	// straight polyline (corner rounding is tiny and labels sit on runs).
	const segLengths = $derived(segments.map((s) => Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y)));
	const totalLength = $derived(segLengths.reduce((sum, l) => sum + l, 0));

	// Flow point at normalised position `t` along the path.
	function pointAtT(t: number): Point {
		if (segments.length === 0) return { x: sourcePoint.x, y: sourcePoint.y };
		const target = Math.max(0, Math.min(1, t)) * totalLength;
		let acc = 0;
		for (let i = 0; i < segments.length; i++) {
			const len = segLengths[i];
			if (acc + len >= target || i === segments.length - 1) {
				const f = len === 0 ? 0 : (target - acc) / len;
				const s = segments[i];
				return { x: s.p1.x + (s.p2.x - s.p1.x) * f, y: s.p1.y + (s.p2.y - s.p1.y) * f };
			}
			acc += len;
		}
		return segments[segments.length - 1].p2;
	}

	// Clamped projection of `p` onto segment a→b: fraction along + distance.
	function projectOnSeg(p: Point, a: Point, b: Point): { f: number; dist: number } {
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len2 = dx * dx + dy * dy;
		let f = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
		f = Math.max(0, Math.min(1, f));
		return { f, dist: Math.hypot(p.x - (a.x + f * dx), p.y - (a.y + f * dy)) };
	}

	// Normalised position of the path point CLOSEST to a flow point `p`.
	function tAtFlowPoint(p: Point): number {
		if (totalLength === 0) return 0.5;
		let bestDist = Infinity;
		let bestLenAlong = 0;
		let acc = 0;
		for (let i = 0; i < segments.length; i++) {
			const s = segments[i];
			const proj = projectOnSeg(p, s.p1, s.p2);
			if (proj.dist < bestDist) {
				bestDist = proj.dist;
				bestLenAlong = acc + proj.f * segLengths[i];
			}
			acc += segLengths[i];
		}
		return bestLenAlong / totalLength;
	}

	// Single "add bend" handle, placed on the longest run of a pristine edge.
	const freeFormLabel = $derived(longestSegmentMidpoint(routedPoints));
	const freeFormAxis = $derived(
		Math.abs(targetPoint.x - sourcePoint.x) >= Math.abs(targetPoint.y - sourcePoint.y)
			? 'h'
			: 'v'
	);

	const active = $derived(hovered || !!selected);
	const strokeColor = $derived(active ? COLOR_ACTIVE : COLOR_DEFAULT);
	const strokeWidth = $derived(active ? WIDTH_ACTIVE : WIDTH_DEFAULT);

	// Solid pill orientation: prefer the segment LEAVING the bend; fall back
	// to the segment entering it. Keeps the pill aligned with its segment
	// even as the edge re-routes during drag.
	function axisAtBend(bendIndex: number): 'h' | 'v' {
		const startSeg = segments.find((s) => s.startBendIndex === bendIndex);
		if (startSeg) return startSeg.axis;
		const endSeg = segments.find((s) => s.endBendIndex === bendIndex);
		return endSeg ? endSeg.axis : 'h';
	}

	function patchBendPoints(updater: (prev: Point[]) => Point[]) {
		flow.updateEdge(id, (edge) => {
			const current = (edge.data ?? {}) as ConnectionEdgeData;
			return {
				data: {
					...current,
					bendPoints: updater(current.bendPoints ?? [])
				}
			};
		});
	}

	function startGhostDrag(segment: Segment, _event: PointerEvent) {
		// Pointer-event stopping is already handled by Pill.svelte's
		// handlePointerDown — it stops propagation to keep the gesture out
		// of xyflow's edge / canvas handlers before invoking us.

		// Dragging a segment's midpoint perpendicular slides the WHOLE
		// segment parallel to itself. That requires TWO bend points (one at
		// each segment endpoint), not one at the midpoint — a single
		// off-axis bend would force the router to inject `down → up` auto-
		// corners that collapse into a spike. If an endpoint is already a
		// user bend, we reuse it; otherwise we insert a new one.
		const segmentAxis = segment.axis;
		const p1 = { ...segment.p1 };
		const p2 = { ...segment.p2 };

		// Indices in bendPoints that we'll keep moving for the rest of the
		// drag. Set inside the patch updater so they reflect the array AFTER
		// any insertions we just performed.
		let startIdx = 0;
		let endIdx = 0;

		patchBendPoints((prev) => {
			const next = [...prev];
			let s = segment.startBendIndex;
			let e = segment.endBendIndex;

			if (s === null) {
				next.splice(segment.bendInsertIndex, 0, p1);
				s = segment.bendInsertIndex;
				// Insertion shifts any existing bend at or after the
				// insertion point up by one.
				if (e !== null && e >= segment.bendInsertIndex) e++;
			}
			if (e === null) {
				const insertAt = s + 1;
				next.splice(insertAt, 0, p2);
				e = insertAt;
			}

			startIdx = s;
			endIdx = e;
			return next;
		});

		const onMove = (ev: PointerEvent) => {
			const flowPos = flow.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
			// Slide perpendicular to the segment axis: both bends share the
			// same new perpendicular coordinate, and each keeps the
			// PARALLEL coordinate of its original endpoint — that's what
			// makes the segment translate cleanly instead of pinching.
			const bendA: Point =
				segmentAxis === 'h' ? { x: p1.x, y: flowPos.y } : { x: flowPos.x, y: p1.y };
			const bendB: Point =
				segmentAxis === 'h' ? { x: p2.x, y: flowPos.y } : { x: flowPos.x, y: p2.y };

			patchBendPoints((prev) => {
				if (startIdx >= prev.length || endIdx >= prev.length) return prev;
				const next = [...prev];
				next[startIdx] = bendA;
				next[endIdx] = bendB;
				return next;
			});
		};

		const onUp = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
		};

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}

	function startSolidDrag(bendIndex: number, _event: PointerEvent) {
		const onMove = (ev: PointerEvent) => {
			const flowPos = flow.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
			patchBendPoints((prev) => {
				if (bendIndex >= prev.length) return prev;
				const next = [...prev];
				next[bendIndex] = { x: flowPos.x, y: flowPos.y };
				return next;
			});
		};

		const onUp = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
		};

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}

	// Grabbing the single handle on a pristine (SmoothStep-routed) edge drops
	// the FIRST user bend at the grab point, which flips the edge into the
	// custom orthogonal router, then immediately drags that new bend. From
	// there the normal solid/ghost pill editing takes over.
	function startAddBendDrag(event: PointerEvent) {
		const flowPos = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
		patchBendPoints(() => [{ x: flowPos.x, y: flowPos.y }]);
		startSolidDrag(0, event);
	}

	// ─── Labels along the edge ──────────────────────────────────────────
	// Minimum centre-to-centre distance (px along the path) between labels.
	// Keeps a sliver of line visible between neighbours and blocks dropping a
	// new label on top of an existing one (the "can't click on a text" rule).
	const MIN_LABEL_GAP_PX = 14;

	function patchLabels(updater: (prev: ConnectionLabel[]) => ConnectionLabel[]) {
		flow.updateEdge(id, (edge) => {
			const current = (edge.data ?? {}) as ConnectionEdgeData;
			return { data: { ...current, labels: updater(current.labels ?? []) } };
		});
	}

	// Open a fresh editor at the clicked point — UNLESS it's within
	// MIN_LABEL_GAP_PX of an existing label (then ignore, so labels never
	// stack). The new label isn't written to data until it's committed with
	// non-empty text, so the editor renders off local state (editingT/draft).
	function createLabelAt(flowPoint: Point) {
		const t = tAtFlowPoint(flowPoint);
		const tooClose = labels.some((l) => Math.abs(l.t - t) * totalLength < MIN_LABEL_GAP_PX);
		if (tooClose) return;
		editingWasNew = true;
		editingT = t;
		draft = '';
		editingId = nanoid();
	}

	function startEditingLabel(labelId: string) {
		const found = labels.find((l) => l.id === labelId);
		if (!found) return;
		editingWasNew = false;
		editingT = found.t;
		draft = found.text;
		editingId = labelId;
	}

	// xyflow's pane swallows the bubbling dblclick: d3-zoom's `dblclick.zoom`
	// handler runs on the pane and the event is consumed before it reaches the
	// listener Svelte uses for delegated `ondblclick` (mounted at the app root).
	// So a plain `ondblclick=` on an edge child NEVER fires. Attaching the
	// listener DIRECTLY makes it run during bubbling BEFORE the pane sees the
	// event; stopPropagation then also suppresses the canvas double-click zoom.

	// GROUP-level: double-click anywhere on the line drops a new label there.
	function dblclickNewLabel(node: Element) {
		const handler = (event: Event) => {
			event.stopPropagation();
			const me = event as MouseEvent;
			createLabelAt(flow.screenToFlowPosition({ x: me.clientX, y: me.clientY }));
		};
		node.addEventListener('dblclick', handler);
		return { destroy: () => node.removeEventListener('dblclick', handler) };
	}

	// LABEL-level: double-click an existing label edits THAT label. Its
	// stopPropagation also keeps the group handler from creating a duplicate.
	function dblclickEditLabel(node: Element, labelId: string) {
		let current = labelId;
		const handler = (event: Event) => {
			event.stopPropagation();
			startEditingLabel(current);
		};
		node.addEventListener('dblclick', handler);
		return {
			update: (next: string) => (current = next),
			destroy: () => node.removeEventListener('dblclick', handler)
		};
	}

	// Seed + focus the contenteditable on mount; caret AFTER the text. rAF
	// waits for the portal to place the node into the edge-label layer first.
	// (An ACTION, not {@attach}: it must run ONCE, not re-run every keystroke.)
	function initEditor(node: HTMLElement) {
		node.textContent = draft;
		requestAnimationFrame(() => {
			node.focus();
			const range = document.createRange();
			range.selectNodeContents(node);
			range.collapse(false); // caret at end
			const sel = window.getSelection();
			sel?.removeAllRanges();
			sel?.addRange(range);
		});
	}

	function onEditorKeydown(event: KeyboardEvent) {
		// Keep keystrokes out of xyflow's global shortcut handler.
		event.stopPropagation();
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			(event.currentTarget as HTMLElement).blur(); // → onEditorBlur commits
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancelled = true;
			(event.currentTarget as HTMLElement).blur(); // → onEditorBlur discards
		}
	}

	// Commit (Enter / click-out): write the draft; empty text prunes the label.
	function commitLabel() {
		const text = draft.trim();
		const targetId = editingId;
		const wasNew = editingWasNew;
		const t = editingT;
		patchLabels((prev) => {
			if (!text) return prev.filter((l) => l.id !== targetId);
			if (wasNew) return [...prev, { id: targetId as string, t, text }];
			return prev.map((l) => (l.id === targetId ? { ...l, text } : l));
		});
		editingId = null;
	}

	// Cancel (Escape): a brand-new label was never written to data, and an
	// existing one is left untouched — so we just close the editor.
	function cancelLabel() {
		editingId = null;
	}

	function onEditorBlur() {
		if (cancelled) {
			cancelled = false;
			cancelLabel();
		} else {
			commitLabel();
		}
	}

	// pointerenter/leave on the outer <g> only fire when the pointer enters
	// or leaves the group as a whole — moving from the line into a pill (or
	// vice versa) does NOT toggle hovered, so pills don't flicker out from
	// under the cursor between hover transitions.
</script>

<g
	role="presentation"
	class="connection-edge"
	use:dblclickNewLabel
	onpointerenter={() => (hovered = true)}
	onpointerleave={() => (hovered = false)}
>
	<!-- Wide invisible interaction strip so the thin line is easy to hit.
         Double-click anywhere on the line drops a text label at that point. -->
	<path
		d={pathD}
		fill="none"
		stroke="transparent"
		stroke-width={HIT_WIDTH}
		stroke-linecap="round"
		stroke-linejoin="round"
		pointer-events="stroke"
		class="connection-hit"
	/>

	<!-- The visible line. CSS transitions on stroke + width avoid flicker. -->
	<path
		d={pathD}
		fill="none"
		stroke-linecap="round"
		stroke-linejoin="round"
		pointer-events="none"
		class="connection-path"
		style={`stroke: ${strokeColor}; stroke-width: ${strokeWidth}px;`}
	/>

	{#if active && !isEditing}
		{#if isFreeForm}
			<!-- Pristine edge: one central handle to add the first bend.
                 Suppressed if a label already sits there. -->
			{#if !nearLabel(freeFormLabel)}
				<Pill
					kind="ghost"
					x={freeFormLabel.x}
					y={freeFormLabel.y}
					axis={freeFormAxis}
					onpointerdown={(e) => startAddBendDrag(e)}
				/>
			{/if}
		{:else}
			{#each segments as segment (segment.index)}
				{#if segment.pillVisible && !nearLabel(segment.mid)}
					<Pill
						kind="ghost"
						x={segment.mid.x}
						y={segment.mid.y}
						axis={segment.axis}
						onpointerdown={(e) => startGhostDrag(segment, e)}
					/>
				{/if}
			{/each}
		{/if}
	{/if}

	{#if selected && !isEditing}
		{#each bendPoints as bend, bendIndex (bendIndex)}
			{#if !nearLabel(bend)}
				<Pill
					kind="solid"
					x={bend.x}
					y={bend.y}
					axis={axisAtBend(bendIndex)}
					onpointerdown={(e) => startSolidDrag(bendIndex, e)}
				/>
			{/if}
		{/each}

		<!--
            Endpoint markers stay anchored to the ORIGINAL (un-inset) border
            point so they mark the border itself, while the line endpoint
            sits ENDPOINT_INSET px deeper inside the node. The marker's
            white fill covers the line in the inset zone (border → inset
            point), so the visible line ends exactly at the marker's outer
            edge = the border. In the unselected state (no marker) the line
            still visibly crosses through the border for a clean plug-in
            look — no gap.
        -->
		<EndpointHandle x={sourceX} y={sourceY} position={sourcePosition} />
		<EndpointHandle x={targetX} y={targetY} position={targetPosition} />

		<!--
            Draggable reconnect affordances. EdgeReconnectAnchor renders into
            the HTML edge-label layer (so it can't host the SVG square above —
            they're intentionally separate: SVG square = visual, this = the
            grab/drag target stacked over the same point, transparent). Grab
            an endpoint and drag it onto another handle (native reconnect) or
            onto empty canvas (left floating via Flow's onReconnectEnd).
        -->
		<EdgeReconnectAnchor type="source" position={{ x: sourceX, y: sourceY }} size={18} />
		<EdgeReconnectAnchor type="target" position={{ x: targetX, y: targetY }} size={18} />
	{/if}
</g>

<!--
    Labels along the edge. Each EdgeLabel portals into xyflow's HTML edge-label
    layer (ABOVE the SVG edges), positioned with translate(-50%, -50%) at the
    flow point for its `t` — so text is always horizontal and the opaque
    background masks the strip of line behind it, giving a clean gap WITHOUT
    ever bending the line. The label being edited renders from local state
    (editingId/editingT/draft) so it shows instantly, before the data round-trip.
-->
{#each labels as lab (lab.id)}
	{#if lab.id !== editingId}
		{@const p = pointAtT(lab.t)}
		<EdgeLabel x={p.x} y={p.y} transparent class="conn-label-host">
			<div
				class="conn-label conn-label--committed nodrag nopan"
				role="button"
				tabindex="-1"
				aria-label="Connection label, double-click to edit"
				use:dblclickEditLabel={lab.id}
				onpointerdown={(e) => e.stopPropagation()}
			>
				{lab.text}
			</div>
		</EdgeLabel>
	{/if}
{/each}

{#if editingId !== null}
	{@const p = pointAtT(editingT)}
	<EdgeLabel x={p.x} y={p.y} transparent class="conn-label-host">
		<div
			class="conn-label conn-label--editing nodrag nopan nowheel"
			role="textbox"
			tabindex="0"
			aria-label="Edit connection label"
			contenteditable="true"
			spellcheck="false"
			use:initEditor
			oninput={(e) => (draft = e.currentTarget.textContent ?? '')}
			onkeydown={onEditorKeydown}
			onblur={onEditorBlur}
			onpointerdown={(e) => e.stopPropagation()}
		></div>
	</EdgeLabel>
{/if}

<style>
	.connection-path {
		transition:
			stroke 0.12s ease,
			stroke-width 0.12s ease;
	}

	/* Strip xyflow's default edge-label padding/background so our inner chip
       fully controls the masked gap. (Portaled out of the component, but the
       passed class is global.) */
	:global(.conn-label-host) {
		padding: 0;
		background: transparent;
	}

	/* Shared label chip. Always horizontal, single line, centred on the edge. */
	.conn-label {
		font-family: inherit;
		font-size: 13px;
		font-weight: 600;
		line-height: 1.25;
		white-space: nowrap;
		color: #1f1d1a;
		padding: 2px 6px;
		border-radius: 2px;
	}

	/* Committed: opaque white background masks the line behind it → clean gap. */
	.conn-label--committed {
		background: #ffffff;
		cursor: text;
		user-select: none;
	}

	/* Editing: blue selection-highlight background, blinking caret, no border. */
	.conn-label--editing {
		background: #b3d4f5;
		cursor: text;
		outline: none;
		min-width: 6px;
		caret-color: #1f1d1a;
		user-select: text;
	}
</style>
