<script lang="ts">
	import { onMount } from 'svelte';
	import NodeContainer from '$lib/components/NodeContainer.svelte';
	import CollapseButton from '$lib/components/sidebar/CollapseButton.svelte';
	import ResizeHandle from '$lib/components/sidebar/ResizeHandle.svelte';
	import { editorMetaData } from '$lib/stores/editor.store.svelte';
	import {
		loadSidebarStateFromStorage,
		sidebarState
	} from '$lib/stores/sidebar.store.svelte';

	let searchBar = $state('');

	const basicShapes = [
		{ label: 'Rectangle', type: 'RectangleNode' },
		{ label: 'Table', type: 'EntityNode' }
	];

	const filteredShapes = $derived(
		basicShapes.filter((shape) =>
			shape.label.toLowerCase().includes(searchBar.toLowerCase())
		)
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
		<input class="file-name" bind:value={editorMetaData.fileName} />
		<input class="search-bar" bind:value={searchBar} placeholder="Search..." />

		<NodeContainer
			heading="Basic Shapes"
			nodes={filteredShapes}
		/>
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
        bottom: 0px;

        margin: 0;

        background: white;

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
        padding: 3em 1.5em 1em;
        gap: 1em;

        display: flex;
        flex-direction: column;

        /* Clip content so it doesn't spill while panel is narrow / collapsed. */
        overflow: hidden;
    }

    aside.collapsed .sidebar-content {
        visibility: hidden;
    }

    input {
        appearance: none;
        -webkit-appearance: none;

        border: none;

        padding: 0;
        margin: 0;

        outline: none;
    }

    .file-name {
        font-weight: bold;
        font-size: 1.2rem;
    }

    .search-bar {
        font-size: 0.8rem;
    }
</style>