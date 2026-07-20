<script lang="ts">
	import { ADDITIONAL_FLOWCHART_DEFINITIONS } from './definitions';

	let { id }: { id: string } = $props();

	function getDefinition(shapeId: string) {
		const definition = ADDITIONAL_FLOWCHART_DEFINITIONS.find(({ id }) => id === shapeId);

		if (!definition) {
			throw new Error(`Unknown additional flowchart icon: ${shapeId}`);
		}

		return definition;
	}

	const definition = $derived(getDefinition(id));
	const geometry = $derived(definition.geometry);
	const transform = $derived(
		`scale(${definition.defaultWidth / 100} ${definition.defaultHeight / 100})`
	);
	const viewBox = $derived(
		id === 'AnnotationNode'
			? `0 0 ${definition.defaultWidth * 0.3} ${definition.defaultHeight}`
			: `0 0 ${definition.defaultWidth} ${definition.defaultHeight}`
	);
	const strokeWidth = $derived(id === 'MultipleDocumentsNode' ? 1.2 : 1.5);
</script>

<svg
	{viewBox}
	xmlns="http://www.w3.org/2000/svg"
	class="size-[26px] overflow-visible"
	preserveAspectRatio="xMidYMid meet"
	aria-hidden="true"
>
	<g {transform}>
		{#if geometry.kind === 'polygon'}
			<polygon
				points={geometry.points}
				fill="var(--flowchart-icon-surface, #fff)"
				stroke="currentColor"
				stroke-width={strokeWidth}
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		{:else if geometry.kind === 'path'}
			<path
				d={geometry.d}
				fill-rule={geometry.fillRule}
				fill="var(--flowchart-icon-surface, #fff)"
				stroke="currentColor"
				stroke-width={strokeWidth}
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		{:else if geometry.kind === 'paths'}
			{#each geometry.items as item (item.d)}
				<path
					d={item.d}
					fill={item.filled === false ? 'none' : 'var(--flowchart-icon-surface, #fff)'}
					stroke="currentColor"
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			{/each}
		{:else if geometry.kind === 'ellipse'}
			<ellipse
				cx="50"
				cy="50"
				rx="49.5"
				ry="49.5"
				fill="var(--flowchart-icon-surface, #fff)"
				stroke="currentColor"
				stroke-width={strokeWidth}
				vector-effect="non-scaling-stroke"
			/>
		{/if}
	</g>
</svg>
