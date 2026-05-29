<script lang="ts">
	import { useDnD } from '$lib/flow/DnDProvider.svelte';
	import type { NodeShape } from '$lib/flow/nodes/registry';

	interface Props {
		heading: string;
		shapes: NodeShape[];
		expanded: boolean;
		onToggle: () => void;
	}

	let { heading, shapes, expanded, onToggle }: Props = $props();

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
	<button
		type="button"
		class="section-toggle"
		aria-expanded={expanded}
		onclick={onToggle}
	>
		<svg
			class="chevron"
			class:expanded
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<polyline points="9 6 15 12 9 18" />
		</svg>
		<span class="section-heading">{heading}</span>
	</button>

	{#if expanded}
		{#if shapes.length === 0}
			<p class="empty-hint">No shapes yet.</p>
		{:else}
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
		{/if}
	{/if}
</section>

<style>
	.shape-section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.section-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: transparent;
		border: none;
		padding: 0.2rem 0;
		margin: 0;
		cursor: pointer;
		color: #76232f;
		text-align: left;
		width: 100%;
	}

	.section-toggle:hover .section-heading {
		text-decoration: underline;
	}

	.section-toggle:focus-visible {
		outline: 2px solid #a6192e;
		outline-offset: 2px;
		border-radius: 4px;
	}

	.chevron {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		transition: transform 0.15s ease;
	}

	.chevron.expanded {
		transform: rotate(90deg);
	}

	.section-heading {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.06em;
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

	.empty-hint {
		font-size: 0.75rem;
		color: #8a8b83;
		font-style: italic;
		margin: 0;
		padding-left: 1.4rem;
	}
</style>
