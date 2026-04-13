<script lang="ts">
	import NodeContainer from '$lib/components/NodeContainer.svelte';
	import { editorMetaData } from '$lib/stores/editor.store.svelte';

	// let fileName = $state("Untitled")
	let searchBar = $state('');

	// Array to be passed into the NodeContainer component
	// Might move this to another file so we can just import
	// instead of writing it here
	const basicShapes = [
		{label: 'Rectangle', type: 'RectangleNode'},
        {label: 'Table', type: 'EntityNode'}
	]
</script>

<aside>

	<input class="file-name" bind:value={editorMetaData.fileName} />
	<input class="search-bar" bind:value={searchBar} placeholder="Search..." />

	<NodeContainer
		heading="Basic Shapes"
		nodes={basicShapes}
	/>
</aside>

<style>
    aside {
        width: 300px;
        /* Keep sidebar inside the canvas shell, above the footer row. */
        position: absolute;
        top: 20px;
        left: 0;
        bottom: 20px;

        padding: 3em 1.5em 1em;
        margin: 0;
        gap: 1em;

        display: flex;
        flex-direction: column;

        background: white;

        border-radius: 0 10px 10px 0;
        border-left: 0;

        box-shadow: 0 0 10px #808080;
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
