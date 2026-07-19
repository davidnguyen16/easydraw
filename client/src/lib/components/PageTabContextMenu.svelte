<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowUpFromLine, X, TextCursorInput, Files } from '@lucide/svelte';

	let {
		x,
		anchorTop,
		canDelete = true,
		onInsert,
		onDelete,
		onRename,
		onDuplicate,
		onClose
	}: {
		/** Screen x (px) to anchor the menu's left edge to. */
		x: number;
		/** Screen y (px) of the tab's top edge — the menu opens upward from here. */
		anchorTop: number;
		canDelete?: boolean;
		onInsert: () => void;
		onDelete: () => void;
		onRename: () => void;
		onDuplicate: () => void;
		onClose: () => void;
	} = $props();

	let menuEl: HTMLDivElement | null = $state(null);

	// The footer sits at the bottom of the screen, so the menu opens UPWARD:
	// pin its bottom just above the tab's top edge.
	const bottom = $derived(typeof window !== 'undefined' ? window.innerHeight - anchorTop + 4 : 0);

	onMount(() => {
		const onPointer = (event: PointerEvent) => {
			if (menuEl && !menuEl.contains(event.target as Node)) onClose();
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('pointerdown', onPointer);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('pointerdown', onPointer);
			window.removeEventListener('keydown', onKey);
		};
	});

	function run(action: () => void, enabled = true) {
		if (enabled) action();
		onClose();
	}
</script>

<div
	bind:this={menuEl}
	class="fixed z-[60] w-40 rounded-md border border-[#E0E0E0] bg-white py-1 shadow-lg"
	style="left: {x}px; bottom: {bottom}px;"
	role="menu"
>
	<button
		type="button"
		role="menuitem"
		class="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#333333]
			hover:bg-[#F5F5F5]"
		onclick={() => run(onInsert)}
	>
		<ArrowUpFromLine class="h-4 w-4 text-[#2196F3]" />
		<span>Insert</span>
	</button>
	<button
		type="button"
		role="menuitem"
		disabled={!canDelete}
		class="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#333333]
			hover:bg-[#F5F5F5] disabled:pointer-events-none disabled:opacity-40"
		onclick={() => run(onDelete, canDelete)}
	>
		<X class="h-4 w-4 text-[#E53935]" />
		<span>Delete</span>
	</button>
	<button
		type="button"
		role="menuitem"
		class="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#333333]
			hover:bg-[#F5F5F5]"
		onclick={() => run(onRename)}
	>
		<TextCursorInput class="h-4 w-4 text-[#2196F3]" />
		<span>Rename</span>
	</button>
	<button
		type="button"
		role="menuitem"
		class="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#333333]
			hover:bg-[#F5F5F5]"
		onclick={() => run(onDuplicate)}
	>
		<Files class="h-4 w-4 text-[#555555]" />
		<span>Duplicate</span>
	</button>
</div>
