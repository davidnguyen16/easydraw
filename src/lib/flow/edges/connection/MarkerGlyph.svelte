<script lang="ts">
	/**
	 * Renders the SVG primitives of one marker kind from the shared
	 * MARKER_GLYPHS geometry. The parent decides the coordinate context:
	 * ConnectionEdge mounts this inside a <marker> def, MarkerPreview inside
	 * a scaled <g>. Colours resolve here: 'color' → the line colour, 'white'
	 * → an opaque mask so the line underneath doesn't show through open glyphs.
	 */
	import { MARKER_GLYPHS } from './marker-glyphs';
	import type { MarkerKind } from './types';

	interface Props {
		kind: Exclude<MarkerKind, 'none'>;
		color: string;
	}

	let { kind, color }: Props = $props();

	const shapes = $derived(MARKER_GLYPHS[kind].shapes);

	function fillOf(fill: 'color' | 'white' | 'none'): string {
		if (fill === 'color') return color;
		if (fill === 'white') return '#ffffff';
		return 'none';
	}
</script>

{#each shapes as s, i (i)}
	{#if s.el === 'path'}
		<path
			d={s.d}
			fill={fillOf(s.fill)}
			stroke={s.stroke ? color : 'none'}
			stroke-width={s.strokeWidth ?? 1.2}
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else if s.el === 'circle'}
		<circle
			cx={s.cx}
			cy={s.cy}
			r={s.r}
			fill={fillOf(s.fill)}
			stroke={s.stroke ? color : 'none'}
			stroke-width={s.strokeWidth ?? 1.2}
		/>
	{:else}
		<rect
			x={s.x}
			y={s.y}
			width={s.width}
			height={s.height}
			fill={fillOf(s.fill)}
			stroke={s.stroke ? color : 'none'}
			stroke-width={s.strokeWidth ?? 1.2}
		/>
	{/if}
{/each}
