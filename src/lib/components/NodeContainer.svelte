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

<section class="flex flex-col gap-[0.6rem]">
	<button
		type="button"
		class="group flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-0 py-[0.2rem] text-left text-mq-maroon focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mq-red"
		aria-expanded={expanded}
		onclick={onToggle}
	>
		<svg
			class="size-3.5 shrink-0 transition-transform duration-150 {expanded ? 'rotate-90' : ''}"
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
		<span class="text-[0.72rem] font-bold tracking-[0.06em] uppercase group-hover:underline"
			>{heading}</span
		>
	</button>

	{#if expanded}
		{#if shapes.length === 0}
			<p class="m-0 pl-[1.4rem] text-[0.75rem] text-ink-muted italic">No shapes yet.</p>
		{:else}
			<div class="grid grid-cols-3 gap-2">
				{#each shapes as shape (shape.id)}
					{@const Icon = shape.icon}
					<button
						type="button"
						class="flex aspect-square cursor-grab items-center justify-center rounded-lg border border-[#e8e2d3] bg-white p-0 text-mq-red transition-[border-color,box-shadow] duration-150 hover:border-mq-red hover:shadow-[0_1px_4px_rgba(166,25,46,0.15)] active:cursor-grabbing"
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
