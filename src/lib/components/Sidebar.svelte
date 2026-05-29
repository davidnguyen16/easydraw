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
		getShapesByCategory,
		type NodeShape,
		type NodeCategory
	} from '$lib/flow/nodes/registry';

	let searchBar = $state('');

	// Fixed display order — every palette category is always visible so the
	// user can see the full taxonomy (BASIC / ARROWS / CONTAINERS / DATABASE /
	// UML) even before shapes have been authored for each one.
	const CATEGORY_ORDER: NodeCategory[] = [
		'basic',
		'arrows',
		'containers',
		'database',
		'uml'
	];

	// Stable display titles per category. Add new entries here when a new
	// NodeCategory is introduced — kept beside the iteration so additions are
	// one line, not a fan-out across the template.
	const CATEGORY_TITLES: Record<NodeCategory, string> = {
		basic: 'BASIC',
		arrows: 'ARROWS',
		containers: 'CONTAINERS',
		database: 'DATABASE',
		uml: 'UML'
	};

	// Per-category expand/collapse state. Default to all collapsed so the
	// palette opens in the compact dropdown-list form.
	let expandedCategories = $state<Record<NodeCategory, boolean>>({
		basic: false,
		arrows: false,
		containers: false,
		database: false,
		uml: false
	});

	function toggleCategory(category: NodeCategory) {
		expandedCategories[category] = !expandedCategories[category];
	}

	function filterShapes(shapes: NodeShape[]): NodeShape[] {
		const query = searchBar.trim().toLowerCase();
		if (!query) return shapes;
		return shapes.filter((s) => s.label.toLowerCase().includes(query));
	}

	const isSearching = $derived(searchBar.trim().length > 0);

	// Sections in fixed order. While searching, only sections with matches
	// are shown and they auto-expand so results are immediately visible.
	const sections = $derived(
		CATEGORY_ORDER.map((category) => {
			const shapes = filterShapes(getShapesByCategory(category));
			return {
				category,
				title: CATEGORY_TITLES[category],
				shapes,
				expanded: isSearching ? shapes.length > 0 : expandedCategories[category]
			};
		}).filter((section) => (isSearching ? section.shapes.length > 0 : true))
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
			<NodeContainer
				heading={section.title}
				shapes={section.shapes}
				expanded={section.expanded}
				onToggle={() => toggleCategory(section.category)}
			/>
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