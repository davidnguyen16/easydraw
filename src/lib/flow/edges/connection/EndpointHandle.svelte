<script lang="ts">
    interface Props {
        x: number;
        y: number;
    }

    let { x, y }: Props = $props();

    const SIZE = 8;
</script>

<rect
    x={x - SIZE / 2}
    y={y - SIZE / 2}
    width={SIZE}
    height={SIZE}
    class="connection-endpoint"
/>

<style>
    .connection-endpoint {
        fill: #ffffff;
        stroke: #5f5e5a;
        stroke-width: 1.5;
        cursor: crosshair;
    }
</style>
