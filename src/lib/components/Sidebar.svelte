<script lang="ts">
	import { onMount } from 'svelte';
	import NodeContainer from '$lib/components/NodeContainer.svelte';
	import CollapseButton from '$lib/components/sidebar/CollapseButton.svelte';
	import ResizeHandle from '$lib/components/sidebar/ResizeHandle.svelte';
	import {
		loadSidebarStateFromStorage,
		sidebarState
	} from '$lib/stores/sidebar.store.svelte';
	import {
		getCategories,
		getShapesByCategory,
		type NodeShape,
		type NodeCategory
	} from '$lib/flow/nodes/registry';

	let searchBar = $state('');

	// Stable display titles per category. Add new entries here when a new
	// NodeCategory is introduced — kept beside the iteration so additions are
	// one line, not a fan-out across the template.
	const CATEGORY_TITLES: Record<NodeCategory, string> = {
		basic: 'BASIC',
		arrows: 'ARROWS',
		containers: 'CONTAINERS',
		database: 'DATABASE'
	};

	function filterShapes(shapes: NodeShape[]): NodeShape[] {
		const query = searchBar.trim().toLowerCase();
		if (!query) return shapes;
		return shapes.filter((s) => s.label.toLowerCase().includes(query));
	}

	// Sections derived live from the registry — adding a shape with a new
	// category surfaces automatically without touching this file.
	const sections = $derived(
		getCategories()
			.map((category) => ({
				category,
				title: CATEGORY_TITLES[category] ?? category.toUpperCase(),
				shapes: filterShapes(getShapesByCategory(category))
			}))
			.filter((section) => section.shapes.length > 0)
	);

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

		{#each sections as section (section.category)}
			<NodeContainer heading={section.title} shapes={section.shapes} />
		{/each}
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

        background: #F5F3EF;

        border-radius: 0;
        border-left: 0;

        box-shadow: 0 0 10px #C4C1B8;

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
        border: 1px solid #D6D2C4;
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
        color: #8A8B83;
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
        color: #373A36;
    }

    .search-bar::placeholder {
        color: #8A8B83;
    }
</style>