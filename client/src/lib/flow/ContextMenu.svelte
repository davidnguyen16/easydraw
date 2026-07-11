<script lang="ts">
	import { getContext } from 'svelte';
	import { useNodes } from '@xyflow/svelte';
	import type { Component } from 'svelte';
	import {
		Trash2,
		Scissors,
		Copy,
		CopyPlus,
		Lock,
		LockOpen,
		ChevronsUp,
		ChevronsDown,
		ChevronUp,
		ChevronDown
	} from '@lucide/svelte';

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

	// Actions are shared with the toolbar / menubar / style panel via the
	// 'editor' context (set in Flow.svelte) — no duplicated logic here. They
	// operate on the current selection; Flow selects the right-clicked node
	// before opening this menu, so they target it.
	interface EditorActions {
		cut: () => void;
		copy: () => void;
		duplicate: () => void;
		deleteSelected: () => void;
		bringToFront: () => void;
		sendToBack: () => void;
		bringForward: () => void;
		sendBackward: () => void;
		toggleNodeLock: (id: string) => void;
	}
	const editor = getContext<EditorActions>('editor');

	const nodes = useNodes();
	const locked = $derived(
		Boolean((nodes.current.find((n) => n.id === id)?.data as { locked?: boolean })?.locked)
	);

	type Item = { label: string; icon: Component; run: () => void; danger?: boolean };

	// Grouped so a divider renders between groups, matching the reference.
	const groups = $derived<Item[][]>([
		[{ label: 'Delete', icon: Trash2, run: () => editor.deleteSelected(), danger: true }],
		[
			{ label: 'Cut', icon: Scissors, run: () => editor.cut() },
			{ label: 'Copy', icon: Copy, run: () => editor.copy() },
			{ label: 'Duplicate', icon: CopyPlus, run: () => editor.duplicate() }
		],
		[{ label: 'Lock', icon: Lock, run: () => editor.toggleNodeLock(id) }],
		[
			{ label: 'To Front', icon: ChevronsUp, run: () => editor.bringToFront() },
			{ label: 'To Back', icon: ChevronsDown, run: () => editor.sendToBack() },
			{ label: 'Bring Forward', icon: ChevronUp, run: () => editor.bringForward() },
			{ label: 'Send Backward', icon: ChevronDown, run: () => editor.sendBackward() }
		]
	]);
</script>

<div
	role="menu"
	tabindex="-1"
	style="top: {top}px; left: {left}px; right: {right}px; bottom: {bottom}px;"
	class="absolute z-10 min-w-[188px] rounded-[10px] border border-line bg-white p-1.5
		shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
	{onclick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
	}}
	onpointerdown={(e) => e.stopPropagation()}
>
	{#if locked}
		<button
			type="button"
			class="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left
				text-[0.85rem] text-ink-soft transition-colors duration-100 hover:bg-[#edebe5] hover:text-ink"
			onclick={() => editor.toggleNodeLock(id)}
		>
			<LockOpen size={16} strokeWidth={1.75} />
			Unlock
		</button>
	{:else}
		{#each groups as group, i (i)}
			{#if i > 0}
				<div class="my-1 h-px bg-line"></div>
			{/if}
			{#each group as item (item.label)}
				{@const Icon = item.icon}
				<button
					type="button"
					class="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left
						text-[0.85rem] transition-colors duration-100
						{item.danger
						? 'text-[#e5484d] hover:bg-[#fdecec]'
						: 'text-ink-soft hover:bg-[#edebe5] hover:text-ink'}"
					onclick={item.run}
				>
					<Icon size={16} strokeWidth={1.75} />
					{item.label}
				</button>
			{/each}
		{/each}
	{/if}
</div>
