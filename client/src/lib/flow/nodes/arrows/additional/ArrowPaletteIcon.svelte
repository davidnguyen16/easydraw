<script lang="ts">
	import {
		ADDITIONAL_ARROW_DEFINITION_BY_ID,
		type AdditionalArrowGeometry,
		type AdditionalArrowId
	} from './definitions';

	interface Props {
		shapeId: AdditionalArrowId;
	}

	let { shapeId }: Props = $props();

	const definition = $derived(ADDITIONAL_ARROW_DEFINITION_BY_ID[shapeId]);
	const geometry = $derived<AdditionalArrowGeometry>(definition.geometry);
	const viewBox = $derived(`0 0 ${definition.defaultWidth} ${definition.defaultHeight}`);
	const transform = $derived(
		`scale(${definition.defaultWidth / 100} ${definition.defaultHeight / 100})`
	);
</script>

<!-- The same normalized path is used here and by ShapeNode on the canvas. -->
<svg
	{viewBox}
	xmlns="http://www.w3.org/2000/svg"
	class="size-[26px] overflow-visible"
	aria-hidden="true"
>
	<g {transform}>
		{#if geometry.kind === 'polygon'}
			<polygon
				points={geometry.points}
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		{:else}
			<path
				d={geometry.d}
				fill-rule={geometry.fillRule}
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		{/if}
	</g>
</svg>
