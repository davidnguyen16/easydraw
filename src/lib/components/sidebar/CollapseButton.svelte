<script lang="ts">
	import {
		persistSidebarState,
		sidebarState,
		toggleCollapse
	} from '$lib/stores/sidebar.store.svelte';

	// Toggles the sidebar's collapsed state and persists it.
	function handleClick() {
		toggleCollapse();
		persistSidebarState();
	}
</script>

<button
	type="button"
	class="absolute top-3 z-20 flex size-6 cursor-pointer items-center justify-center rounded-full border border-line bg-white text-base leading-none text-ink-soft shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:bg-[#edebe5] {sidebarState.isCollapsed
		? '-right-8'
		: 'right-2'}"
	aria-label={sidebarState.isCollapsed ? 'Open sidebar' : 'Close sidebar'}
	aria-expanded={!sidebarState.isCollapsed}
	onclick={handleClick}
>
	{sidebarState.isCollapsed ? '»' : '«'}
</button>
