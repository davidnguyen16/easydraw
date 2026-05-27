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
    class="connection-pill"
    class:kind-ghost={kind === 'ghost'}
    class:kind-solid={kind === 'solid'}
    class:axis-h={isHorizontal}
    class:axis-v={!isHorizontal}
    class:pressing
    onpointerdown={handlePointerDown}
/>

<style>
    .connection-pill {
        stroke-width: 1;
        transition: stroke-opacity 0.12s ease, fill 0.12s ease, filter 0.12s ease;
        /*
         * `bounding-box` extends the click target to the full rect, including
         * the area outside the rounded corners. Without it, clicks at the
         * rounded-corner edge fall through to the line behind the pill.
         */
        pointer-events: bounding-box;
        transform-box: fill-box;
        transform-origin: center;
    }

    /* Ghost = midpoint placeholder. Solid white fill fully covers the line
       behind it, so the line never bleeds through the pill's center. */
    .kind-ghost {
        fill: #ffffff;
        stroke: #9B9991;
        stroke-opacity: 0.55;
    }

    .kind-ghost:hover {
        stroke-opacity: 1;
    }

    /* Solid = real user bend point. */
    .kind-solid {
        fill: #76232F;
        stroke: #76232F;
    }

    /* Pressed state: bumps the pill forward visually so the user gets
       feedback the moment they grab it, and keeps showing it for the whole
       drag (managed by the `pressing` state, not just :active). */
    .connection-pill.pressing {
        filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.22));
    }

    .kind-ghost.pressing {
        stroke-opacity: 1;
        stroke-width: 1.5;
    }

    .kind-solid.pressing {
        fill: #5A1220;
        stroke: #5A1220;
    }

    /* Cursor mirrors the drag axis: ghost pills move perpendicular to the
       segment they sit on, solid pills move freely. */
    .kind-ghost.axis-h {
        cursor: ns-resize;
    }

    .kind-ghost.axis-v {
        cursor: ew-resize;
    }

    .kind-solid {
        cursor: move;
    }
</style>
