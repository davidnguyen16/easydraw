<script lang="ts">
    import { useSvelteFlow, type EdgeProps } from '@xyflow/svelte';
    import EndpointHandle from './EndpointHandle.svelte';
    import Pill from './Pill.svelte';
    import { buildSegments, buildSvgPath, buildVertices, positionToAxis } from './routing';
    import type { ConnectionEdgeData, Point, Segment } from './types';

    let {
        id,
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

    let hovered = $state(false);

    const connectionData = $derived((data ?? {}) as ConnectionEdgeData);
    const bendPoints = $derived(connectionData.bendPoints ?? []);

    const sourcePoint = $derived({ x: sourceX, y: sourceY });
    const targetPoint = $derived({ x: targetX, y: targetY });
    const sourceAxis = $derived(positionToAxis(sourcePosition));

    const vertices = $derived(buildVertices(sourcePoint, targetPoint, sourceAxis, bendPoints));
    const segments = $derived(buildSegments(vertices));
    const pathD = $derived(buildSvgPath(vertices, CORNER_RADIUS));

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

        <EndpointHandle x={sourceX} y={sourceY} />
        <EndpointHandle x={targetX} y={targetY} />
    {/if}
</g>

<style>
    .connection-path {
        transition: stroke 0.12s ease, stroke-width 0.12s ease;
    }
</style>
