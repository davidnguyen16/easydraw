<script lang="ts">
	import { onMount } from 'svelte';
	import NodeContainer from '$lib/components/NodeContainer.svelte';
	import CollapseButton from '$lib/components/sidebar/CollapseButton.svelte';
	import ResizeHandle from '$lib/components/sidebar/ResizeHandle.svelte';
	import { loadSidebarStateFromStorage, sidebarState } from '$lib/stores/sidebar.store.svelte';
	import {
		getShapesByCategory,
		type NodeShape,
		type NodeCategory
	} from '$lib/flow/nodes/registry';

	let searchBar = $state('');

	// Fixed display order — every palette category is always visible so the
	// user can see the full taxonomy (BASIC / ARROWS / ENTITY RELATION / UML)
	// even before shapes have been authored for each one.
	const CATEGORY_ORDER: NodeCategory[] = ['basic', 'arrows', 'flowchart', 'entity-relation', 'uml'];

	// Stable display titles per category. Add new entries here when a new
	// NodeCategory is introduced — kept beside the iteration so additions are
	// one line, not a fan-out across the template.
	const CATEGORY_TITLES: Record<NodeCategory, string> = {
		basic: 'BASIC',
		arrows: 'ARROWS',
		flowchart: 'FLOWCHART',
		'entity-relation': 'ENTITY RELATION',
		uml: 'UML'
	};

	// Per-category expand/collapse state. Default to all collapsed so the
	// palette opens in the compact dropdown-list form.
	let expandedCategories = $state<Record<NodeCategory, boolean>>({
		basic: false,
		arrows: false,
		flowchart: false,
		'entity-relation': false,
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

<!-- Width transition ONLY while not dragging: collapse/expand still animates,
     but a live resize tracks the cursor 1:1 — with the 150ms ease always on,
     the edge kept chasing the pointer and the drag felt rubbery. -->
<aside
	class="absolute top-[0.2%] bottom-0 left-0 m-0 rounded-none border-l-0 bg-panel {sidebarState.isResizing
		? ''
		: 'transition-[width] duration-150'} {sidebarState.isCollapsed
		? 'shadow-none'
		: 'shadow-[0_0_10px_#c4c1b8]'}"
	style:width={sidebarState.isCollapsed ? '0px' : `${sidebarState.width}px`}
>
	<div
		class="flex h-full w-full flex-col gap-[1.4em] overflow-x-hidden overflow-y-auto px-[1.2em] pt-[2.5em] pb-[1em] {sidebarState.isCollapsed
			? 'invisible'
			: ''}"
		aria-hidden={sidebarState.isCollapsed}
	>
		<div
			class="flex h-9 items-center rounded-lg border border-line bg-white px-2.5
				focus-within:border-mq-red"
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="size-4 shrink-0 text-ink-muted"
			>
				<circle cx="11" cy="11" r="7" />
				<line x1="20" y1="20" x2="16.5" y2="16.5" />
			</svg>
			<input
				class="min-w-0 flex-1 appearance-none border-none bg-transparent px-2 text-[0.9rem]
					text-ink-soft outline-none placeholder:text-ink-muted"
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
