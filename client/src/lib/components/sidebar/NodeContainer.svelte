<script lang="ts">
	import { useDnD } from '$lib/flow/DnDProvider.svelte';
	import type { NodeShape, PaletteGroupId } from '$lib/flow/nodes/registry';

	interface PaletteGroup {
		id: PaletteGroupId;
		heading: string;
		shapes: readonly NodeShape[];
		expanded: boolean;
	}

	interface Props {
		heading: string;
		shapes: readonly NodeShape[];
		groups?: readonly PaletteGroup[];
		expanded: boolean;
		onToggle: () => void;
		onGroupToggle: (group: PaletteGroupId) => void;
	}

	let { heading, shapes, groups = [], expanded, onToggle, onGroupToggle }: Props = $props();

	const dnd = useDnD();

	// Stash the dropped shape's id in the DnD context so Flow.onDrop can
	// look it up in the registry. Icons stay decoupled from the drop logic.
	function onDragStart(event: DragEvent, shapeId: string) {
		if (!event.dataTransfer) return;
		dnd.current = shapeId;
		event.dataTransfer.effectAllowed = 'move';
	}
</script>

{#snippet shapeGrid(items: readonly NodeShape[])}
	<!-- Lucidchart-style reflow: auto-fill adds/drops a column whenever
	     another 40px track fits. Nested groups deliberately keep this grid
	     full-width so the resizable sidebar never clips an indented track. -->
	<div class="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-2">
		{#each items as shape (shape.id)}
			{@const Icon = shape.icon}
			{@const iconProps = shape.paletteIconProps ?? {}}
			<button
				type="button"
				class="flex aspect-square cursor-grab items-center justify-center rounded-lg border
					border-[#e8e2d3] bg-white p-0 text-mq-red transition-[border-color,box-shadow]
					duration-150 hover:border-mq-red hover:shadow-[0_1px_4px_rgba(166,25,46,0.15)]
					active:cursor-grabbing"
				aria-label={shape.label}
				title={shape.label}
				draggable={true}
				ondragstart={(event) => onDragStart(event, shape.id)}
			>
				<Icon {...iconProps} />
			</button>
		{/each}
	</div>
{/snippet}

<section class="flex flex-col gap-[0.6rem]">
	<button
		type="button"
		class="group flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-0
			py-[0.2rem] text-left text-mq-maroon focus-visible:rounded focus-visible:outline-2
			focus-visible:outline-offset-2 focus-visible:outline-mq-red"
		aria-expanded={expanded}
		onclick={onToggle}
	>
		<svg
			class="size-3.5 shrink-0 transition-transform duration-150 {expanded
				? 'rotate-90'
				: ''}"
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
		{#if groups.length > 0}
			<div class="flex min-w-0 flex-col gap-3">
				{#each groups as group (group.id)}
					<section class="flex min-w-0 flex-col gap-2">
						<button
							type="button"
							class="group flex min-w-0 w-full cursor-pointer items-center gap-1.5 border-none
								bg-transparent py-[0.15rem] pr-0 pl-2 text-left text-ink-soft
								focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2
								focus-visible:outline-mq-red"
							aria-expanded={group.expanded}
							onclick={() => onGroupToggle(group.id)}
						>
							<svg
								class="size-3 shrink-0 transition-transform duration-150 {group.expanded
									? 'rotate-90'
									: ''}"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.25"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<polyline points="9 6 15 12 9 18" />
							</svg>
							<span
								class="min-w-0 text-[0.75rem] leading-snug font-semibold group-hover:underline"
								>{group.heading}</span
							>
						</button>

						{#if group.expanded}
							{#if group.shapes.length === 0}
								<p class="m-0 pl-5 text-[0.75rem] text-ink-muted italic">
									No shapes yet.
								</p>
							{:else}
								{@render shapeGrid(group.shapes)}
							{/if}
						{/if}
					</section>
				{/each}
			</div>
		{:else if shapes.length === 0}
			<p class="m-0 pl-[1.4rem] text-[0.75rem] text-ink-muted italic">No shapes yet.</p>
		{:else}
			{@render shapeGrid(shapes)}
		{/if}
	{/if}
</section>
