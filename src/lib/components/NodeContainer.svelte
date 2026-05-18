<script lang="ts">
	import { useDnD } from '$lib/flow/DnDProvider.svelte';
	import type { NodeShape } from '$lib/flow/nodes/registry';

	interface Props {
		heading: string;
		shapes: NodeShape[];
	}

	let { heading, shapes }: Props = $props();

	const dnd = useDnD();

	// Stash the dropped shape's id in the DnD context so Flow.onDrop can
	// look it up in the registry. Icons stay decoupled from the drop logic.
	function onDragStart(event: DragEvent, shapeId: string) {
		if (!event.dataTransfer) return;
		dnd.current = shapeId;
		event.dataTransfer.effectAllowed = 'move';
	}
</script>

<section class="shape-section">
	<h3 class="section-heading">{heading}</h3>
	<div class="shape-grid">
		{#each shapes as shape (shape.id)}
			{@const Icon = shape.icon}
			<button
				type="button"
				class="shape-tile"
				aria-label={shape.label}
				title={shape.label}
				draggable={true}
				ondragstart={(event) => onDragStart(event, shape.id)}
			>
				<Icon />
			</button>
		{/each}
	</div>
</section>

<style>
	.shape-section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.section-heading {
		font-size: 0.72rem;
		font-weight: 700;
		color: #76232f;
		letter-spacing: 0.06em;
		margin: 0;
		text-transform: uppercase;
	}

	.shape-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.shape-tile {
		background: #ffffff;
		border: 1px solid #e8e2d3;
		border-radius: 8px;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: grab;
		color: #a6192e;
		padding: 0;
		transition: border-color 0.12s ease, box-shadow 0.12s ease;
	}

	.shape-tile:hover {
		border-color: #a6192e;
		box-shadow: 0 1px 4px rgba(166, 25, 46, 0.15);
	}

	.shape-tile:active {
		cursor: grabbing;
	}
</style>
