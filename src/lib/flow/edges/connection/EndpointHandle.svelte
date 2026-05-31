<script lang="ts">
    import { Position } from '@xyflow/svelte';

    interface Props {
        x: number;
        y: number;
        /**
         * The xyflow Position the connection enters / leaves this point from
         * (Top / Right / Bottom / Left). When provided, the marker is
         * offset so it sits ENTIRELY OUTSIDE the node, with the edge facing
         * the node touching (x, y). Falls back to a centred square when the
         * direction isn't known so this stays drop-in compatible with older
         * call sites.
         */
        position?: Position;
    }

    let { x, y, position }: Props = $props();

    const SIZE = 8;

    // Marker is positioned INSIDE the node, with the edge touching the
    // border at (x, y). This is what kills the visible gap: the connection
    // line is drawn to (x, y) and the marker's solid white fill would
    // otherwise hide the last `SIZE` pixels of the line if the marker sat
    // on the outside of the border — making the line look like it stops
    // short. With the marker tucked inside, the line stays visible all
    // the way to the border, and the marker reads as a small square
    // plugged into the inner face of the border.
    const rectX = $derived(
        position === Position.Left
            ? x
            : position === Position.Right
                ? x - SIZE
                : x - SIZE / 2
    );

    const rectY = $derived(
        position === Position.Top
            ? y
            : position === Position.Bottom
                ? y - SIZE
                : y - SIZE / 2
    );
</script>

<rect
    x={rectX}
    y={rectY}
    width={SIZE}
    height={SIZE}
    class="connection-endpoint"
/>

<style>
    .connection-endpoint {
        fill: #ffffff;
        stroke: #9B9991;
        stroke-width: 1.5;
        cursor: crosshair;
    }
</style>
