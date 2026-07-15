<script lang="ts">
	import { getContext } from 'svelte';
	import { Position, useSvelteFlow, type EdgeProps } from '@xyflow/svelte';
	import ConnectionLabels from './ConnectionLabels.svelte';
	import EndpointHandle from './EndpointHandle.svelte';
	import Pill from './Pill.svelte';
	import {
		buildBezier,
		buildSegments,
		buildSvgPath,
		buildVertices,
		longestSegmentMidpoint,
		positionToAxis,
		routeOrthogonal,
		type Rect
	} from './routing';
	import { ANCHOR_HANDLE_ID, ANCHOR_NODE_TYPE } from '../nodes/anchor/anchor';
	import MarkerGlyph from './MarkerGlyph.svelte';
	import { MARKER_GLYPHS } from './marker-glyphs';
	import { createConnectionLabelEditor } from './connection-label-editor.svelte';
	import { insetForEnd, outlineInsetRatioForType } from './endpoint-insets';
	import type {
		Axis,
		ConnectionEdgeData,
		ConnectionLabel,
		MarkerKind,
		Point,
		Segment
	} from './types';

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
		sourceHandleId,
		targetHandleId,
		selected,
		data
	}: EdgeProps = $props();

	const flow = useSvelteFlow();

	// Provided by Flow.svelte — adds a floating-endpoint anchor (only Flow owns
	// the nodes array) and returns its id. Used by the endpoint reconnect drag.
	const addAnchorNode = getContext<(p: Point) => string>('addAnchorNode');

	// Provided by Flow.svelte — makes this edge the sole selection so the toolbar
	// text controls target it while its label is being edited (the label eats
	// pointer events, so editing never selects the edge on its own).
	const selectEdgeForStyling = getContext<(edgeId: string) => void>('selectEdgeForStyling');

	// Provided by Flow.svelte — rigid-moves a fully-floating connection (both
	// anchors + bend points in one tick). Flow owns the nodes/edges arrays, so
	// the whole translation goes through that single owner.
	const moveFloatingConnection =
		getContext<
			(update: {
				edgeId: string;
				sourceId: string;
				sourcePosition: Point;
				targetId: string;
				targetPosition: Point;
				bendPoints: Point[];
			}) => void
		>('moveFloatingConnection');

	// ─── Visual constants ───────────────────────────────────────────────
	const COLOR_DEFAULT = '#B4B2A9';
	const COLOR_ACTIVE = '#5F5E5A';
	const WIDTH_DEFAULT = 1.5;
	const CORNER_RADIUS = 8;
	const HIT_WIDTH = 20;

	let hovered = $state(false);

	// Which end (if any) is currently being reconnect-dragged. Kept so the
	// endpoint handles + active styling stay visible for the whole drag even if
	// the pointer leaves the line (which would otherwise clear `hovered`).
	let draggingEnd = $state<'source' | 'target' | null>(null);

	const connectionData = $derived((data ?? {}) as ConnectionEdgeData);
	const bendPoints = $derived(connectionData.bendPoints ?? []);

	// ─── Line appearance (driven by ConnectionStylePanel) ───────────────
	// Every field is optional on data; the fallbacks reproduce the original
	// connection look so pre-existing edges render unchanged.
	const routing = $derived(connectionData.routing ?? 'orthogonal');
	const isOrthogonal = $derived(routing === 'orthogonal');
	const lineStyle = $derived(connectionData.lineStyle ?? 'solid');
	const lineCap = $derived(connectionData.lineCap ?? 'round');
	// A near-zero dash only becomes a visible dot with round caps. Presets may
	// use a flat cap for their open tail, so dotted lines override that here.
	const renderedLineCap = $derived(lineStyle === 'dotted' ? 'round' : lineCap);
	const markerStart = $derived<MarkerKind>(connectionData.markerStart ?? 'none');
	const markerEnd = $derived<MarkerKind>(connectionData.markerEnd ?? 'none');
	const userStrokeWidth = $derived(connectionData.strokeWidth ?? WIDTH_DEFAULT);
	const userStrokeColor = $derived(connectionData.strokeColor);

	// Dash pattern scales with width so dashes/dots stay legible on thick lines.
	const dashArray = $derived(
		lineStyle === 'dashed'
			? `${userStrokeWidth * 5} ${userStrokeWidth * 3.5}`
			: lineStyle === 'dotted'
				? // Round-capped dash of 1× width renders as a fat round dot (~2×
					// width across), spaced ~2× width apart: clearly visible instead
					// of the near-invisible hairline dots, yet still far shorter than
					// the long dashes above so the two styles stay distinct.
					`${userStrokeWidth} ${userStrokeWidth * 2}`
				: undefined
	);

	// Geometry (viewBox, anchor point, flush behaviour) of the two end glyphs
	// comes from the shared MARKER_GLYPHS catalog — the same definitions the
	// panel previews render, so what you pick is exactly what the edge draws.
	const startGlyph = $derived(markerStart === 'none' ? null : MARKER_GLYPHS[markerStart]);
	const endGlyph = $derived(markerEnd === 'none' ? null : MARKER_GLYPHS[markerEnd]);

	// ─── Label text style ───────────────────────────────────────────────
	// Applied to every label on this edge. Set via the toolbar font / size /
	// B / I / U / colour controls while the edge is selected (stored on
	// edge.data). Defaults reproduce the original connection-label look
	// (Inter, 13px, semibold, near-black) so unstyled edges are unchanged.
	const labelFontFamily = $derived(connectionData.fontFamily ?? 'Inter');
	const labelFontSize = $derived(connectionData.fontSize ?? 13);
	const labelBold = $derived(!!connectionData.bold);
	const labelItalic = $derived(!!connectionData.italic);
	const labelUnderline = $derived(!!connectionData.underline);
	const labelColor = $derived(connectionData.textColor ?? '#1f1d1a');

	const labelStyle = $derived(
		[
			`color: ${labelColor}`,
			`font-family: ${labelFontFamily}`,
			`font-size: ${labelFontSize}px`,
			// Unbolded labels stay semibold (600) for legibility over the line;
			// the Bold toggle pushes them to 700.
			`font-weight: ${labelBold ? '700' : '600'}`,
			`font-style: ${labelItalic ? 'italic' : 'normal'}`,
			`text-decoration: ${labelUnderline ? 'underline' : 'none'}`
		].join('; ')
	);

	function nodeTypeOf(nodeId: string): string | undefined {
		return flow.getInternalNode(nodeId)?.type;
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

	// Inset fraction for a node's end at `position`, or 0 when it doesn't inset.
	function outlineInsetRatio(nodeId: string, position: Position): number {
		return outlineInsetRatioForType(nodeTypeOf(nodeId), position);
	}

	function insetForNodeEnd(
		nodeId: string,
		point: Point,
		position: Position,
		marker: MarkerKind = 'none'
	): Point {
		return insetForEnd({
			nodeType: nodeTypeOf(nodeId),
			point,
			position,
			marker,
			rect: rectOf(nodeId)
		});
	}
	// A connection anchor is a free wire end — treat it as FLOATING so the
	// released edge routes exactly like the drag preview (which had no node at
	// the pointer). See routeOrthogonal's floating handling.
	function isAnchor(nodeId: string): boolean {
		return flow.getInternalNode(nodeId)?.type === ANCHOR_NODE_TYPE;
	}

	const sourceFloating = $derived(isAnchor(source));
	const targetFloating = $derived(isAnchor(target));

	// BOTH ends floating → the connection is a free-standing object. Grabbing
	// the line body then moves the WHOLE thing rigidly (see startMoveDrag);
	// reshaping stays on its dedicated affordances only: endpoint dots (4-way
	// cursor) and pills. With at least one end attached the path is derived
	// from that node, so whole-line dragging stays off there.
	const fullyFloating = $derived(sourceFloating && targetFloating);

	// True while the whole connection is being rigid-dragged. Gates the ghost
	// pill so the reshape affordance doesn't chase the cursor mid-move.
	let movingWhole = $state(false);

	// Anchor nodes use origin [0.5, 0.5], so their user-node position is the
	// exact visual centre of the floating endpoint. xyflow's measured handle
	// coordinate can differ by a few pixels; using it would inject a tiny first
	// segment and rotate a marker-start (such as ||) onto that wrong segment.
	function floatingAnchorPoint(nodeId: string, fallback: Point): Point {
		return flow.getNode(nodeId)?.position ?? fallback;
	}

	// Line endpoints. For a real node, shift the tip `ENDPOINT_INSET` px inward
	// so the line crosses the border instead of stopping at it. For a FLOATING
	// end (anchor) there is no border to cross — and insetting would pull the
	// tip off the wire end, breaking the match with the drag preview — so the
	// raw point is used.
	const sourcePoint = $derived(
		sourceFloating
			? floatingAnchorPoint(source, { x: sourceX, y: sourceY })
			: insetForNodeEnd(source, { x: sourceX, y: sourceY }, sourcePosition, markerStart)
	);
	const targetPoint = $derived(
		targetFloating
			? floatingAnchorPoint(target, { x: targetX, y: targetY })
			: insetForNodeEnd(target, { x: targetX, y: targetY }, targetPosition, markerEnd)
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
			// An inset-outline end (triangle/parallelogram sides, document bottom)
			// sits inside its own bbox in an empty region, so skip avoiding that
			// node's own rect — otherwise the leaving stub is bent around the shape
			// even though it only crosses that empty region, not the body.
			sourceRect:
				sourceFloating || outlineInsetRatio(source, sourcePosition) > 0
					? null
					: rectOf(source),
			sourceFloating,
			target: targetPoint,
			targetPosition,
			targetRect:
				targetFloating || outlineInsetRatio(target, targetPosition) > 0
					? null
					: rectOf(target),
			targetFloating
		})
	);

	// 'curved' routing: bezier path + a polyline sampling of it. The samples
	// feed the segment math below so labels (position, dodging) keep working
	// without bezier-aware arc-length code.
	const curve = $derived(
		routing === 'curved'
			? buildBezier({
					source: sourcePoint,
					sourcePosition,
					target: targetPoint,
					targetPosition,
					sourceFloating,
					targetFloating
				})
			: null
	);

	const vertices = $derived.by(() => {
		if (routing === 'straight') {
			// Direct line — bends don't apply.
			return [sourcePoint, targetPoint].map((point) => ({
				point,
				bendIndex: null as number | null
			}));
		}
		if (curve) {
			return curve.samples.map((point) => ({ point, bendIndex: null as number | null }));
		}
		return isFreeForm
			? routedPoints.map((point) => ({ point, bendIndex: null as number | null }))
			: buildVertices(sourcePoint, targetPoint, sourceAxis, bendPoints);
	});
	const segments = $derived(buildSegments(vertices));
	// The curved path renders the true bezier; its sampled polyline is only for
	// segment math. Straight/orthogonal paths render from their vertices.
	const pathD = $derived(curve ? curve.d : buildSvgPath(vertices, CORNER_RADIUS));

	const labels = $derived((connectionData.labels ?? []) as ConnectionLabel[]);

	// Footprint of each committed label, so bend/ghost pills can DODGE the text
	// instead of being buried under it. Text is always horizontal, so the box
	// is axis-aligned: width follows the text length, height ≈ the chip height.
	// A pill whose centre falls inside a (padded) box is suppressed.
	// Per-character advance + half-height scale with the label font size so the
	// dodge box still fits the text when the user enlarges/​shrinks the label.
	// (~0.55em advance reproduces the original 7px at the default 13px size.)
	const labelCharPx = $derived(Math.max(7, labelFontSize * 0.55));
	const labelBoxes = $derived(
		labels.map((l) => {
			const c = pointAtT(l.t);
			return {
				cx: c.x,
				cy: c.y,
				halfW: Math.max(10, (l.text.length * labelCharPx) / 2) + 12,
				halfH: Math.max(21, labelFontSize + 8)
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

	// The pristine edge's lone "add bend" pill. Normally sits at the longest-run
	// midpoint, but if a label already covers that spot we SLIDE it along the
	// line to the nearest clear point — dodging the text instead of vanishing,
	// so a labelled edge is always still draggable.
	const freeFormPill = $derived.by<{ x: number; y: number; axis: Axis }>(() => {
		const natural = freeFormLabel;
		if (labels.length === 0 || !nearLabel(natural)) {
			return { x: natural.x, y: natural.y, axis: freeFormAxis };
		}
		const base = tAtFlowPoint(natural);
		for (let step = 0.04; step <= 0.5; step += 0.04) {
			for (const t of [base + step, base - step]) {
				if (t <= 0.05 || t >= 0.95) continue;
				const p = pointAtT(t);
				if (!nearLabel(p)) return { x: p.x, y: p.y, axis: freeFormAxis };
			}
		}
		// Whole line is covered by labels — keep the natural spot as a fallback.
		return { x: natural.x, y: natural.y, axis: freeFormAxis };
	});

	// ─── Cursor-following ghost pill (Lucidchart-style restraint) ───────
	// A multi-segment edge used to render one ghost pill on EVERY long-enough
	// segment, which reads as clutter. Instead we track the pointer while it's
	// over the edge and show a SINGLE ghost pill, on the segment nearest the
	// cursor — the affordance appears right where the user is about to grab,
	// and the line stays clean everywhere else.
	let hoverFlowPos = $state<Point | null>(null);

	const hoverGhostSegment = $derived.by<Segment | null>(() => {
		if (!hoverFlowPos) return null;
		let best: Segment | null = null;
		let bestDist = Infinity;
		for (const s of segments) {
			if (!s.pillVisible || nearLabel(s.mid)) continue;
			const proj = projectOnSeg(hoverFlowPos, s.p1, s.p2);
			if (proj.dist < bestDist) {
				bestDist = proj.dist;
				best = s;
			}
		}
		return best;
	});

	const active = $derived(hovered || !!selected || draggingEnd !== null);
	// A custom colour always shows as-is (active state is already obvious from
	// the endpoint handles / pills); the default grey still darkens on active.
	const strokeColor = $derived(userStrokeColor ?? (active ? COLOR_ACTIVE : COLOR_DEFAULT));
	const strokeWidth = $derived(active ? userStrokeWidth + 0.5 : userStrokeWidth);

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

	// Grabbing the single handle on a pristine (SmoothStep-routed) edge has to
	// flip the edge into the custom bend router. The naive way — dropping one
	// bend at the grab point — reshapes a multi-corner route into a different
	// shape the instant the routers switch ("the line jumps / distorts").
	//
	// To avoid that we SEED the bend list with the route's CURRENT interior
	// corners: buildVertices walks those same orthogonal corners and reproduces
	// the exact polyline, so nothing moves. Then we hand off to a normal segment
	// slide on the longest run (where the pill sits) — drag it and only that run
	// moves, like editing any other bend.
	function startAddBendDrag(event: PointerEvent) {
		const interior = routedPoints.slice(1, -1);

		// Straight pristine edge (no interior corners): a single bend at the grab
		// point IS the whole path, so it can't reshape — keep the simple "pull a
		// point out" behaviour.
		if (interior.length === 0) {
			const flowPos = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
			patchBendPoints(() => [{ x: flowPos.x, y: flowPos.y }]);
			startSolidDrag(0, event);
			return;
		}

		// Multi-corner edge: seed the existing corners (no visual change), then
		// slide the longest segment — computed from the SEEDED path directly,
		// since the reactive `segments` haven't re-derived yet this tick.
		patchBendPoints(() => interior);
		const seeded = buildSegments(buildVertices(sourcePoint, targetPoint, sourceAxis, interior));
		let longest = seeded[0];
		let bestLen = -1;
		for (const seg of seeded) {
			const len = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.y - seg.p1.y);
			if (len > bestLen) {
				bestLen = len;
				longest = seg;
			}
		}
		startGhostDrag(longest, event);
	}

	// ─── Endpoint reconnect drag (draw.io / drawnode style) ─────────────
	// Within this many flow px of a real node's handle, the dragged end SNAPS
	// onto it; released anywhere else it's left floating at the pointer.
	const SNAP_DIST = 22;

	// Repoints one end of THIS edge at a node + handle (or an anchor + its
	// handle). The other end is left untouched.
	function repointEdge(end: 'source' | 'target', nodeId: string, handleId: string | null) {
		flow.updateEdge(id, () =>
			end === 'source'
				? { source: nodeId, sourceHandle: handleId }
				: { target: nodeId, targetHandle: handleId }
		);
	}

	// The node/handle the endpoint should snap onto for `flowPos`, or null.
	// Snaps when the pointer is INSIDE a node's box (drop "into the node" → its
	// nearest handle) OR within SNAP_DIST of any handle (precise edge snap).
	// Anchors are skipped; so is ONLY the exact handle the OTHER end already
	// occupies (a zero-length self-edge) — self-loops onto a DIFFERENT handle of
	// the same node are allowed, so they highlight + connect like any other node.
	// Handle positions come from xyflow's measured handleBounds, so custom
	// (non-cardinal) handles snap correctly too.
	function nearestHandle(flowPos: Point, exclude: { nodeId: string; handleId: string | null }) {
		type Hit = { nodeId: string; handleId: string | null; x: number; y: number };
		let best: Hit | null = null;
		let bestDist = SNAP_DIST;
		let inside: Hit | null = null; // node whose box contains the pointer (wins)
		for (const node of flow.getNodes()) {
			if (node.type === ANCHOR_NODE_TYPE) continue;
			const internal = flow.getInternalNode(node.id);
			const pos = internal?.internals?.positionAbsolute;
			const bounds = internal?.internals?.handleBounds;
			if (!pos || !bounds) continue;

			// Nearest handle of THIS node (skipping the other end's exact handle).
			let nodeBest: Hit | null = null;
			let nodeBestDist = Infinity;
			for (const h of [...(bounds.source ?? []), ...(bounds.target ?? [])]) {
				const hid = h.id ?? null;
				if (node.id === exclude.nodeId && hid === exclude.handleId) continue;
				const hx = pos.x + h.x + h.width / 2;
				const hy = pos.y + h.y + h.height / 2;
				const d = Math.hypot(hx - flowPos.x, hy - flowPos.y);
				if (d < nodeBestDist) {
					nodeBestDist = d;
					nodeBest = { nodeId: node.id, handleId: hid, x: hx, y: hy };
				}
			}
			if (!nodeBest) continue;

			const w = internal.measured?.width ?? 0;
			const h = internal.measured?.height ?? 0;
			if (
				flowPos.x >= pos.x &&
				flowPos.x <= pos.x + w &&
				flowPos.y >= pos.y &&
				flowPos.y <= pos.y + h
			) {
				inside = nodeBest; // pointer over the node body → snap here
			}
			if (nodeBestDist < bestDist) {
				bestDist = nodeBestDist;
				best = nodeBest;
			}
		}
		return inside ?? best;
	}

	// Grab an endpoint and drag it. The dragged end always rides a (temporary)
	// anchor so the wire end follows the cursor exactly — no separate preview to
	// leave a dot stranded in mid-air. On release: snapped onto a handle → repoint
	// the edge there (the temp anchor is then orphaned and the Flow prune effect
	// collects it); otherwise the anchor stays as the floating end.
	function startEndpointDrag(end: 'source' | 'target', event: PointerEvent) {
		event.stopPropagation();
		event.preventDefault();
		draggingEnd = end;
		// Lock the cursor to "grabbing" for the whole gesture so it doesn't flip
		// back to the default arrow as the pointer rides over the pane / nodes.
		document.body.classList.add('endpoint-dragging');

		const endNodeId = end === 'source' ? source : target;
		// The fixed (other) end — its exact node+handle is the only thing the drag
		// may NOT snap onto (would make a zero-length self-edge). Snapping back onto
		// the SAME node via a different handle is allowed (a self-loop).
		const otherEnd = {
			nodeId: end === 'source' ? target : source,
			handleId: (end === 'source' ? targetHandleId : sourceHandleId) ?? null
		};
		const startPoint =
			end === 'source'
				? sourceFloating
					? sourcePoint
					: { x: sourceX, y: sourceY }
				: targetFloating
					? targetPoint
					: { x: targetX, y: targetY };

		// Reuse an already-floating anchor; otherwise detach from the node onto a
		// fresh anchor at the current endpoint so the edge is anchor-bound for the
		// whole drag (always referenced → never pruned mid-drag).
		let anchorId: string;
		if (isAnchor(endNodeId)) {
			anchorId = endNodeId;
		} else {
			anchorId = addAnchorNode(startPoint);
			repointEdge(end, anchorId, ANCHOR_HANDLE_ID);
		}

		let snapped: { nodeId: string; handleId: string | null } | null = null;

		// Highlight the node the endpoint will snap onto: light it up + reveal its
		// 4 handles (via the `conn-snap-target` class on the node wrapper), so it's
		// obvious where the drop will connect. Tracks the current target so the
		// previous one is cleared as the pointer moves between nodes.
		let snapNodeId: string | null = null;
		const setSnapTarget = (nodeId: string | null) => {
			if (snapNodeId === nodeId) return;
			if (snapNodeId) flow.updateNode(snapNodeId, { class: undefined });
			snapNodeId = nodeId;
			if (snapNodeId) flow.updateNode(snapNodeId, { class: 'conn-snap-target' });
		};

		const onMove = (ev: PointerEvent) => {
			const flowPos = flow.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
			const hit = nearestHandle(flowPos, otherEnd);
			snapped = hit ? { nodeId: hit.nodeId, handleId: hit.handleId } : null;
			setSnapTarget(hit ? hit.nodeId : null);
			// Park the anchor on the handle while snapped (endpoint reads as
			// attached), else let it follow the pointer freely.
			const at = hit ? { x: hit.x, y: hit.y } : flowPos;
			flow.updateNode(anchorId, { position: at });
		};

		const onUp = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			document.body.classList.remove('endpoint-dragging');
			setSnapTarget(null); // clear the highlight
			draggingEnd = null;
			if (snapped) repointEdge(end, snapped.nodeId, snapped.handleId);
		};

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}

	// ─── Whole-connection move (fully-floating edges only) ──────────────
	// Grab the LINE BODY (not a pill, not an endpoint dot — both stop
	// propagation before reaching the strip) and the whole connection
	// translates like a node: both anchors + every bend shift by the same
	// pointer delta, so the shape NEVER deforms. Cursor contract: grab/grabbing
	// here, 4-way move on the endpoint dots, pills keep their own — whatever
	// the cursor shows is what the drag will do.
	function startMoveDrag(event: PointerEvent) {
		if (!fullyFloating || event.button !== 0) return;

		// Own the gesture like a node drag does: if this pointerdown reached the
		// pane, SvelteFlow's left-drag pan would compete with the move and keep
		// shifting screenToFlowPosition under us.
		event.preventDefault();
		event.stopPropagation();
		selectEdgeForStyling(id);
		movingWhole = true;

		// Keep receiving the pointer even when it leaves the thin hit strip.
		const dragTarget = event.currentTarget as Element;
		dragTarget.setPointerCapture?.(event.pointerId);

		const startFlow = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
		const src0 = { ...(flow.getNode(source)?.position ?? sourcePoint) };
		const tgt0 = { ...(flow.getNode(target)?.position ?? targetPoint) };
		const bends0 = bendPoints.map((p) => ({ ...p }));
		// Lock the closed-hand cursor for the whole gesture (same pattern as
		// endpoint-dragging) so it never flips back mid-drag.
		document.body.classList.add('connection-dragging');

		const onMove = (ev: PointerEvent) => {
			const flowPos = flow.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
			const dx = flowPos.x - startFlow.x;
			const dy = flowPos.y - startFlow.y;
			moveFloatingConnection({
				edgeId: id,
				sourceId: source,
				sourcePosition: { x: src0.x + dx, y: src0.y + dy },
				targetId: target,
				targetPosition: { x: tgt0.x + dx, y: tgt0.y + dy },
				bendPoints: bends0.map((p) => ({ x: p.x + dx, y: p.y + dy }))
			});
		};

		const onUp = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
			if (dragTarget.hasPointerCapture?.(event.pointerId)) {
				dragTarget.releasePointerCapture(event.pointerId);
			}
			document.body.classList.remove('connection-dragging');
			movingWhole = false;
		};

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}

	// Label editing lives in a small controller; the edge keeps only the data
	// patcher because xyflow owns edge updates.
	function patchLabels(updater: (prev: ConnectionLabel[]) => ConnectionLabel[]) {
		flow.updateEdge(id, (edge) => {
			const current = (edge.data ?? {}) as ConnectionEdgeData;
			return { data: { ...current, labels: updater(current.labels ?? []) } };
		});
	}

	const labelEditor = createConnectionLabelEditor({
		getLabels: () => labels,
		getTotalLength: () => totalLength,
		tAtFlowPoint,
		screenToFlowPosition: (point) => flow.screenToFlowPosition(point),
		patchLabels,
		selectEdgeForStyling: () => selectEdgeForStyling(id)
	});

	function createLabelOnDblclick(node: Element) {
		return labelEditor.attachCreateOnDblclick(node);
	}

	$effect(() => {
		labelEditor.blurIfDeselected(selected);
	});

	$effect(() => labelEditor.installClickAway());
	// pointerenter/leave on the outer <g> only fire when the pointer enters
	// or leaves the group as a whole — moving from the line into a pill (or
	// vice versa) does NOT toggle hovered, so pills don't flicker out from
	// under the cursor between hover transitions.
</script>

<g
	role="presentation"
	class="connection-edge"
	use:createLabelOnDblclick
	onpointerenter={() => (hovered = true)}
	onpointerleave={() => {
		hovered = false;
		hoverFlowPos = null;
	}}
	onpointermove={(e) =>
		(hoverFlowPos = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }))}
>
	<!-- Endpoint markers (arrow heads, …). Ids embed the edge id so multiple
         edges' defs never collide; orient auto/auto-start-reverse lets one
         glyph serve both ends. markerUnits defaults to strokeWidth so heads
         scale with the line width, like draw.io. -->
	<defs>
		{#if markerStart !== 'none' && startGlyph}
			<marker
				id={`cm-s-${id}`}
				viewBox="0 0 {startGlyph.w} 10"
				markerWidth={startGlyph.w}
				markerHeight="10"
				refX={startGlyph.refX}
				refY="5"
				orient="auto-start-reverse"
			>
				<MarkerGlyph kind={markerStart} color={strokeColor} />
			</marker>
		{/if}
		{#if markerEnd !== 'none' && endGlyph}
			<marker
				id={`cm-e-${id}`}
				viewBox="0 0 {endGlyph.w} 10"
				markerWidth={endGlyph.w}
				markerHeight="10"
				refX={endGlyph.refX}
				refY="5"
				orient="auto"
			>
				<MarkerGlyph kind={markerEnd} color={strokeColor} />
			</marker>
		{/if}
	</defs>

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
		role="presentation"
		style={fullyFloating ? 'cursor: grab;' : undefined}
		onpointerdown={startMoveDrag}
	/>

	<!-- The visible line. CSS transitions on stroke + width avoid flicker. -->
	<path
		d={pathD}
		fill="none"
		stroke-linecap={renderedLineCap}
		stroke-linejoin="round"
		pointer-events="none"
		class="transition-[stroke,stroke-width] duration-[120ms]"
		marker-start={markerStart !== 'none' ? `url(#cm-s-${id})` : undefined}
		marker-end={markerEnd !== 'none' ? `url(#cm-e-${id})` : undefined}
		stroke-dasharray={dashArray}
		style={`stroke: ${strokeColor}; stroke-width: ${strokeWidth}px;`}
	/>

	<!-- Bend pills only exist for orthogonal routing — straight and curved
         paths have no draggable segments. Hidden while the whole connection
         is being rigid-moved so the reshape affordance doesn't chase the
         cursor mid-move. -->
	{#if active && !labelEditor.isEditing && isOrthogonal && !movingWhole}
		{#if isFreeForm}
			<!-- Pristine edge: one handle to add the first bend. It slides along
                 the line to dodge any label, so it's never hidden entirely. -->
			<Pill
				kind="ghost"
				x={freeFormPill.x}
				y={freeFormPill.y}
				axis={freeFormPill.axis}
				onpointerdown={(e) => startAddBendDrag(e)}
			/>
		{:else if hoverGhostSegment}
			<!-- Bent edge: a single ghost pill on the segment nearest the cursor
                 (see hoverGhostSegment) instead of one per segment — the grab
                 affordance shows up where it's needed, nothing else. -->
			{@const seg = hoverGhostSegment}
			<Pill
				kind="ghost"
				x={seg.mid.x}
				y={seg.mid.y}
				axis={seg.axis}
				onpointerdown={(e) => startGhostDrag(seg, e)}
			/>
		{/if}
	{/if}

	{#if selected && !labelEditor.isEditing && isOrthogonal}
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
	{/if}

	<!--
        Endpoint handles (draw.io / drawnode style). Shown while hovered OR
        selected, so an end can be grabbed straight off a hover. Each rides a
        temporary anchor for the duration of the drag (startEndpointDrag): drop
        it on a node's handle to reconnect there, or on empty canvas to leave it
        floating. `floating` styles a free end as a dashed white dot, vs a solid
        dot when it's pinned to a node.
    -->
	{#if active && !labelEditor.isEditing}
		<!-- On a fully-floating edge the line body is itself grabbable (whole
	         move), so the endpoint dots get a LARGER hit radius — the 4-way
	         "this drag reshapes" zone must win the overlap with the strip. -->
		<EndpointHandle
			x={sourceFloating ? sourcePoint.x : sourceX}
			y={sourceFloating ? sourcePoint.y : sourceY}
			floating={sourceFloating}
			hit={fullyFloating ? 16 : 10}
			onpointerdown={(e) => startEndpointDrag('source', e)}
		/>
		<EndpointHandle
			x={targetFloating ? targetPoint.x : targetX}
			y={targetFloating ? targetPoint.y : targetY}
			floating={targetFloating}
			hit={fullyFloating ? 16 : 10}
			onpointerdown={(e) => startEndpointDrag('target', e)}
		/>
	{/if}
</g>

<ConnectionLabels {labels} {selected} {labelStyle} {pointAtT} editor={labelEditor} />

<style>
	/*
	 * Only :global rules remain — they reach xyflow's DOM (snap-target node
	 * wrapper), the <body> drag class, and the portaled label host, none of
	 * which are elements this component renders directly. The line's transition
	 * and the label chips are now Tailwind utilities in the template above.
	 */

	/* While an endpoint is being dragged, force the move cursor everywhere so it
	   never flickers back to the arrow over the pane / a node. Toggled by
	   startEndpointDrag via a class on <body>. */
	:global(body.endpoint-dragging),
	:global(body.endpoint-dragging *) {
		cursor: move !important;
	}

	/* While a fully-floating connection is being rigid-moved as one object,
	   keep the closed-hand cursor everywhere. Toggled by startMoveDrag. */
	:global(body.connection-dragging),
	:global(body.connection-dragging *) {
		cursor: grabbing !important;
	}

	/* The node the dragged endpoint will snap onto — shown EXACTLY like that
	   node's own hover state (reveal its handles; entity also gets its soft hover
	   shadow), NOT a bolder ring. The `conn-snap-target` class is set on the node
	   wrapper during the drag. */
	:global(.svelte-flow__node.conn-snap-target .shape-conn),
	:global(.svelte-flow__node.conn-snap-target .entity-handle) {
		opacity: 1 !important;
		pointer-events: all;
	}
	:global(.svelte-flow__node.conn-snap-target .entity-card) {
		box-shadow: 0 4px 12px rgba(166, 25, 46, 0.15);
	}

	/* Strip xyflow's default edge-label padding/background so our inner chip
       fully controls the masked gap. (Portaled out of the component, but the
       passed class is global.) */
	:global(.conn-label-host) {
		padding: 0;
		background: transparent;
	}
</style>
