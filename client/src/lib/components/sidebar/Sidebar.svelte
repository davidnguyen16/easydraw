<script lang="ts">
	import { onMount } from 'svelte';
	import NodeContainer from '$lib/components/sidebar/NodeContainer.svelte';
	import CollapseButton from '$lib/components/sidebar/CollapseButton.svelte';
	import ResizeHandle from '$lib/components/sidebar/ResizeHandle.svelte';
	import { loadSidebarStateFromStorage, sidebarState } from '$lib/stores/sidebar.store.svelte';
	import {
		getShapesByCategory,
		type NodeShape,
		type NodeCategory,
		type PaletteGroupId
	} from '$lib/flow/nodes/registry';

	let searchBar = $state('');

	// Every configured category/group stays visible even before its shapes are
	// authored; search temporarily removes empty branches.
	interface PaletteGroupDefinition {
		id: PaletteGroupId;
		title: string;
	}

	interface PaletteCategoryDefinition {
		id: NodeCategory;
		title: string;
		groups?: readonly PaletteGroupDefinition[];
	}

	// Ordered palette taxonomy. Categories without groups keep the original
	// flat grid; NETWORK opts into a second accordion level.
	const PALETTE_CATEGORIES: readonly PaletteCategoryDefinition[] = [
		{ id: 'basic', title: 'BASIC' },
		{ id: 'arrows', title: 'ARROWS' },
		{ id: 'flowchart', title: 'FLOWCHART' },
		{ id: 'entity-relation', title: 'ENTITY RELATION' },
		{ id: 'uml', title: 'UML' },
		{
			id: 'network',
			title: 'NETWORK',
			groups: [
				{ id: 'network-devices', title: 'Network Devices' },
				{ id: 'security-traffic', title: 'Security & Traffic' },
				{ id: 'end-devices', title: 'End Devices' },
				{ id: 'servers-storage', title: 'Servers & Storage' },
				{ id: 'wan-cloud', title: 'WAN & Cloud' },
				{ id: 'zones-containers', title: 'Zones & Containers' },
				{ id: 'connections', title: 'Connections' }
			]
		}
	];

	// Per-category expand/collapse state. Default to all collapsed so the
	// palette opens in the compact dropdown-list form.
	let expandedCategories = $state(
		Object.fromEntries(PALETTE_CATEGORIES.map(({ id }) => [id, false])) as Record<
			NodeCategory,
			boolean
		>
	);

	type GroupExpansionKey = `${NodeCategory}:${PaletteGroupId}`;
	let expandedGroups = $state<Partial<Record<GroupExpansionKey, boolean>>>({});

	function groupExpansionKey(category: NodeCategory, group: PaletteGroupId): GroupExpansionKey {
		return `${category}:${group}`;
	}

	function toggleCategory(category: NodeCategory) {
		expandedCategories[category] = !expandedCategories[category];
	}

	function toggleGroup(category: NodeCategory, group: PaletteGroupId) {
		const key = groupExpansionKey(category, group);
		expandedGroups[key] = !expandedGroups[key];
	}

	const searchQuery = $derived(searchBar.trim().toLowerCase());
	const isSearching = $derived(searchQuery.length > 0);

	function filterShapes(shapes: readonly NodeShape[]): NodeShape[] {
		if (!searchQuery) return [...shapes];
		return shapes.filter((shape) =>
			[shape.label, ...(shape.searchAliases ?? [])].some((term) =>
				term.toLowerCase().includes(searchQuery)
			)
		);
	}

	// Search derives temporary open states without changing the user's saved
	// category/group choices. Empty result groups and categories disappear.
	const sections = $derived(
		PALETTE_CATEGORIES.map((definition) => {
			const categoryShapes = getShapesByCategory(definition.id);
			const groups = (definition.groups ?? [])
				.map((group) => {
					const shapes = filterShapes(
						categoryShapes.filter((shape) => shape.paletteGroup === group.id)
					);

					return {
						id: group.id,
						heading: group.title,
						shapes,
						expanded: isSearching
							? shapes.length > 0
							: (expandedGroups[groupExpansionKey(definition.id, group.id)] ?? false)
					};
				})
				.filter((group) => (isSearching ? group.shapes.length > 0 : true));

			const shapes = definition.groups ? [] : filterShapes(categoryShapes);
			const hasVisibleContent = shapes.length > 0 || groups.length > 0;

			return {
				category: definition.id,
				title: definition.title,
				shapes,
				groups,
				expanded: isSearching ? hasVisibleContent : expandedCategories[definition.id]
			};
		}).filter((section) =>
			isSearching ? section.shapes.length > 0 || section.groups.length > 0 : true
		)
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
				groups={section.groups}
				expanded={section.expanded}
				onToggle={() => toggleCategory(section.category)}
				onGroupToggle={(group) => toggleGroup(section.category, group)}
			/>
		{/each}
	</div>

	<CollapseButton />
	{#if !sidebarState.isCollapsed}
		<ResizeHandle />
	{/if}
</aside>
