<script lang="ts">
	import { useNodes, useSvelteFlow } from '@xyflow/svelte';
	import { nanoid } from 'nanoid';

	let {
		id,
		top,
		left,
		right,
		bottom,
		onclick
	}: {
		id: string;
		top: number | undefined;
		left: number | undefined;
		right: number | undefined;
		bottom: number | undefined;
		onclick: () => void;
	} = $props();

	const { deleteElements } = useSvelteFlow();

	const nodes = useNodes();

	function duplicateNode() {
		const node = nodes.current.find((node) => node.id === id);
		if (node) {
			nodes.current = [
				...nodes.current,
				{
					...node,
					id: nanoid(),
					position: {
						x: node.position.x,
						y: node.position.y + 100
					}
				}
			];
		}
	}

	function deleteNode() {
		deleteElements({ nodes: [{ id }] });
	}
</script>

<div
	role="button"
	tabindex="0"
	style="top: {top}px; left: {left}px; right: {right}px; bottom: {bottom}px;"
	class="absolute z-10 min-w-[140px] rounded-[10px] border border-line bg-white p-1 shadow-[0_12px_28px_rgba(0,0,0,0.1)]"
	{onclick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.stopPropagation();
		}
	}}
	onpointerdown={(e) => e.stopPropagation()}
>
	<p class="m-2">
		<small class="text-[0.72rem] font-bold tracking-[0.06em] text-ink-muted uppercase"
			>Edit Node:</small
		>
	</p>
	<span>
		<button
			class="block w-full cursor-pointer rounded-md px-3 py-2 text-left text-[0.875rem] text-ink-soft transition-colors duration-100 hover:bg-[#edebe5] hover:text-ink"
			onclick={duplicateNode}>Duplicate</button
		>
		<button
			class="block w-full cursor-pointer rounded-md px-3 py-2 text-left text-[0.875rem] text-ink-soft transition-colors duration-100 hover:bg-[#edebe5] hover:text-ink"
			onclick={deleteNode}>Delete</button
		>
	</span>
</div>
