<script lang="ts">
	import {
		ADDITIONAL_UML_DEFINITION_BY_ID,
		type AdditionalUmlGeometry,
		type AdditionalUmlId
	} from './definitions';

	let { id }: { id: AdditionalUmlId } = $props();

	const definition = $derived(ADDITIONAL_UML_DEFINITION_BY_ID[id]);
	const geometry = $derived(definition.geometry as AdditionalUmlGeometry);
	const transform = $derived(
		`scale(${definition.defaultWidth / 100} ${definition.defaultHeight / 100})`
	);
	const viewBox = $derived(`0 0 ${definition.defaultWidth} ${definition.defaultHeight}`);
	const surface = 'var(--uml-icon-surface, #fff)';
	const bodyFill = $derived(definition.iconFill === 'ink' ? 'currentColor' : surface);
	const markSize = $derived(Math.min(definition.defaultWidth, definition.defaultHeight) * 0.22);
</script>

<svg
	{viewBox}
	xmlns="http://www.w3.org/2000/svg"
	class="size-[26px] overflow-visible"
	preserveAspectRatio="xMidYMid meet"
	aria-hidden="true"
>
	<g {transform}>
		{#if geometry.kind === 'ellipse'}
			<ellipse
				cx="50"
				cy="50"
				rx="49"
				ry="49"
				fill={bodyFill}
				stroke="currentColor"
				stroke-width="1.5"
				vector-effect="non-scaling-stroke"
			/>
		{:else if geometry.kind === 'polygon'}
			<polygon
				points={geometry.points}
				fill={bodyFill}
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		{:else if geometry.kind === 'polygons'}
			{#each geometry.items as points (points)}
				<polygon
					{points}
					fill={bodyFill}
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			{/each}
		{:else if geometry.kind === 'path'}
			<path
				d={geometry.d}
				fill-rule={geometry.fillRule}
				fill={bodyFill}
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		{:else if geometry.kind === 'paths'}
			{#each geometry.items as item (item.d)}
				<path
					d={item.d}
					fill={item.filled === false ? 'none' : bodyFill}
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			{/each}
		{:else if geometry.kind === 'bullseye'}
			<circle
				cx="50"
				cy="50"
				r="48"
				fill={surface}
				stroke="currentColor"
				stroke-width="1.5"
				vector-effect="non-scaling-stroke"
			/>
			<circle cx="50" cy="50" r="22" fill="currentColor" />
		{/if}
	</g>

	{#if definition.iconMark}
		<text
			x={definition.defaultWidth / 2}
			y={definition.defaultHeight * 0.18}
			fill="currentColor"
			font-family="Inter, ui-sans-serif, system-ui, sans-serif"
			font-size={markSize}
			font-weight="700"
			text-anchor="middle"
			dominant-baseline="middle"
		>
			{definition.iconMark}
		</text>
	{/if}
</svg>
