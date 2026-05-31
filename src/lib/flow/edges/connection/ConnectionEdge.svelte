<script lang="ts">
    import {
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
    import type { ConnectionEdgeData, Point, Segment } from './types';

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
            case Position.Top:    return { x: p.x, y: p.y + ENDPOINT_INSET };
            case Position.Right:  return { x: p.x - ENDPOINT_INSET, y: p.y };
            case Position.Bottom: return { x: p.x, y: p.y - ENDPOINT_INSET };
            case Position.Left:   return { x: p.x + ENDPOINT_INSET, y: p.y };
            default:              return p;
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
                segmentAxis === 'h'
                    ? { x: p1.x, y: flowPos.y }
                    : { x: flowPos.x, y: p1.y };
            const bendB: Point =
                segmentAxis === 'h'
                    ? { x: p2.x, y: flowPos.y }
                    : { x: flowPos.x, y: p2.y };

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

    // pointerenter/leave on the outer <g> only fire when the pointer enters
    // or leaves the group as a whole — moving from the line into a pill (or
    // vice versa) does NOT toggle hovered, so pills don't flicker out from
    // under the cursor between hover transitions.
</script>

<g
    role="presentation"
    class="connection-edge"
    onpointerenter={() => (hovered = true)}
    onpointerleave={() => (hovered = false)}
>
    <!-- Wide invisible interaction strip so the thin line is easy to hit. -->
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

    {#if active}
        {#if isFreeForm}
            <!-- Pristine edge: one central handle to add the first bend. -->
            <Pill
                kind="ghost"
                x={freeFormLabel.x}
                y={freeFormLabel.y}
                axis={freeFormAxis}
                onpointerdown={(e) => startAddBendDrag(e)}
            />
        {:else}
            {#each segments as segment (segment.index)}
                {#if segment.pillVisible}
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

    {#if selected}
        {#each bendPoints as bend, bendIndex (bendIndex)}
            <Pill
                kind="solid"
                x={bend.x}
                y={bend.y}
                axis={axisAtBend(bendIndex)}
                onpointerdown={(e) => startSolidDrag(bendIndex, e)}
            />
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

<style>
    .connection-path {
        transition: stroke 0.12s ease, stroke-width 0.12s ease;
    }
</style>
