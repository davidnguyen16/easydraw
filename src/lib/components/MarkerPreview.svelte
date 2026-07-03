<script lang="ts">
	/**
	 * A line + line-ending glyph preview, shared by the connection panel's
	 * Start/End dropdowns (short, mirrored for the start end) and the Line
	 * endings dialog rows (long). Glyph geometry comes from the shared
	 * MARKER_GLYPHS catalog, so previews always match what the edge draws.
	 */
	import MarkerGlyph from '$lib/flow/edges/connection/MarkerGlyph.svelte';
	import { MARKER_GLYPHS } from '$lib/flow/edges/connection/marker-glyphs';
	import type { MarkerKind } from '$lib/flow/edges/connection/types';

	interface Props {
		kind: MarkerKind;
		/** Which end of the line the glyph decorates. 'start' mirrors the svg. */
		end?: 'start' | 'end';
		width?: number;
		color?: string;
	}

	let { kind, end = 'end', width = 44, color = '#2c2c2a' }: Props = $props();

	// Glyphs are authored in a w×10 box; scale slightly up to fill the 12px
	// preview height. White-filled glyphs mask the line, so it can always run
	// to the tip.
	const SCALE = 1.1;

	const t = $derived(width - 2);
	const glyph = $derived(kind === 'none' ? null : MARKER_GLYPHS[kind]);
</script>

<svg viewBox="0 0 {width} 12" {width} height="12" aria-hidden="true">
	<g transform={end === 'start' ? `matrix(-1 0 0 1 ${width} 0)` : undefined}>
		<line x1="2" y1="6" x2={t} y2="6" stroke={color} stroke-width="1.6" stroke-linecap="round" />
		{#if glyph && kind !== 'none'}
			<g transform="translate({t - glyph.refX * SCALE}, {6 - 5 * SCALE}) scale({SCALE})">
				<MarkerGlyph {kind} {color} />
			</g>
		{/if}
	</g>
</svg>
