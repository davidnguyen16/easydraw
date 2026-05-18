<script lang="ts">
	import { onMount } from 'svelte';
	import NodeContainer from '$lib/components/NodeContainer.svelte';
	import CollapseButton from '$lib/components/sidebar/CollapseButton.svelte';
	import ResizeHandle from '$lib/components/sidebar/ResizeHandle.svelte';
	import {
		loadSidebarStateFromStorage,
		sidebarState
	} from '$lib/stores/sidebar.store.svelte';

	let searchBar = $state('');

	const basicShapes = [
		{ label: 'Rectangle', type: 'RectangleNode', icon: 'rectangle' },
		{ label: 'Circle', type: 'RectangleNode', icon: 'circle' },
		{ label: 'Triangle', type: 'RectangleNode', icon: 'triangle' },
		{ label: 'Diamond', type: 'RectangleNode', icon: 'diamond' },
		{ label: 'Pill', type: 'RectangleNode', icon: 'pill' },
		{ label: 'Pentagon', type: 'RectangleNode', icon: 'pentagon' }
	];

	const arrowShapes = [
		{ label: 'Arrow', type: 'RectangleNode', icon: 'arrow-right' },
		{ label: 'Double Arrow', type: 'RectangleNode', icon: 'arrow-double' },
		{ label: 'Bent Arrow', type: 'RectangleNode', icon: 'arrow-bent' }
	];

	const containerShapes = [
		{ label: 'Dashed Container', type: 'RectangleNode', icon: 'dashed-rect' },
		{ label: 'Rounded Container', type: 'RectangleNode', icon: 'rounded-rect' },
		{ label: 'Grid Container', type: 'RectangleNode', icon: 'grid-4' }
	];

	const databaseShapes = [
		{ label: 'Entity', type: 'EntityNode', icon: 'entity' }
	];

	function filterShapes<T extends { label: string }>(shapes: T[]): T[] {
		const query = searchBar.trim().toLowerCase();
		if (!query) return shapes;
		return shapes.filter((s) => s.label.toLowerCase().includes(query));
	}

	const filteredBasic = $derived(filterShapes(basicShapes));
	const filteredArrows = $derived(filterShapes(arrowShapes));
	const filteredContainers = $derived(filterShapes(containerShapes));
	const filteredDatabase = $derived(filterShapes(databaseShapes));

	onMount(() => {
		loadSidebarStateFromStorage();
	});
</script>

<aside
	class:collapsed={sidebarState.isCollapsed}
	style:width={sidebarState.isCollapsed ? '0px' : `${sidebarState.width}px`}
>
	<div class="sidebar-content" aria-hidden={sidebarState.isCollapsed}>
		<div class="search-wrapper">
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="search-icon"
			>
				<circle cx="11" cy="11" r="7" />
				<line x1="20" y1="20" x2="16.5" y2="16.5" />
			</svg>
			<input
				class="search-bar"
				bind:value={searchBar}
				placeholder="Search shapes"
			/>
		</div>

		{#if filteredBasic.length}
			<NodeContainer heading="BASIC" shapes={filteredBasic} />
		{/if}
		{#if filteredArrows.length}
			<NodeContainer heading="ARROWS" shapes={filteredArrows} />
		{/if}
		{#if filteredContainers.length}
			<NodeContainer heading="CONTAINERS" shapes={filteredContainers} />
		{/if}
		{#if filteredDatabase.length}
			<NodeContainer heading="DATABASE" shapes={filteredDatabase} />
		{/if}
	</div>

	<CollapseButton />
	{#if !sidebarState.isCollapsed}
		<ResizeHandle />
	{/if}
</aside>

<style>
    aside {
        position: absolute;
        top: 0.2%;
        left: 0;
        bottom: 0;

        margin: 0;

        background: #F5F1E8;

        border-radius: 0;
        border-left: 0;

        box-shadow: 0 0 10px #bfbbbb;

        /* Smooth width change when toggling collapse / dragging finishes. */
        transition: width 0.15s ease;
    }

    aside.collapsed {
        box-shadow: none;
    }

    .sidebar-content {
        width: 100%;
        height: 100%;
        padding: 2.5em 1.2em 1em;
        gap: 1.4em;

        display: flex;
        flex-direction: column;

        /* Allow vertical scrolling when many sections are present. */
        overflow-y: auto;
        overflow-x: hidden;
    }

    aside.collapsed .sidebar-content {
        visibility: hidden;
    }

    .search-wrapper {
        display: flex;
        align-items: center;
        background: #ffffff;
        border: 1px solid #e8e2d3;
        border-radius: 8px;
        padding: 0 10px;
        height: 36px;
    }

    .search-wrapper:focus-within {
        border-color: #A6192E;
    }

    .search-icon {
        width: 16px;
        height: 16px;
        color: #888;
        flex-shrink: 0;
    }

    .search-bar {
        appearance: none;
        -webkit-appearance: none;
        border: none;
        outline: none;
        background: transparent;
        font-size: 0.9rem;
        padding: 0 8px;
        flex: 1;
        min-width: 0;
        color: #333;
    }

    .search-bar::placeholder {
        color: #999;
    }
</style>