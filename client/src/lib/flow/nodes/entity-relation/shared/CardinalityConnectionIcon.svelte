<script lang="ts">
	import MarkerGlyph from '../../../edges/MarkerGlyph.svelte';
	import { MARKER_GLYPHS } from '../../../edges/marker-glyphs';
	import type { CardinalityMarker } from './cardinality-preset';

	interface Props {
		markerStart?: CardinalityMarker;
		markerEnd: CardinalityMarker;
	}

	let { markerStart, markerEnd }: Props = $props();

	const markerScale = 0.76;
	const startGlyph = $derived(markerStart ? MARKER_GLYPHS[markerStart] : null);
	const endGlyph = $derived(MARKER_GLYPHS[markerEnd]);
</script>

<!--
	The glyphs come from the same geometry catalog as ConnectionEdge, so every
	palette preview keeps the correct circle/bar/crow's-foot order at both ends.
-->
<svg viewBox="0 0 28 26" xmlns="http://www.w3.org/2000/svg" class="size-[26px]" aria-hidden="true">
	<path
		d="M0.8,21.5 L10.5,21.5 Q12,21.5 12,20 L12,6 Q12,4.5 13.5,4.5 L27.2,4.5"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="butt"
		stroke-linejoin="round"
	/>

	{#if markerStart && startGlyph}
		<g
			transform={`translate(0.8 21.5) rotate(180) scale(${markerScale}) translate(${-startGlyph.refX} -5)`}
		>
			<MarkerGlyph kind={markerStart} color="currentColor" />
		</g>
	{/if}

	<g transform={`translate(27.2 4.5) scale(${markerScale}) translate(${-endGlyph.refX} -5)`}>
		<MarkerGlyph kind={markerEnd} color="currentColor" />
	</g>
</svg>
