<script lang="ts">
	import NodeContainer from '$lib/components/NodeContainer.svelte';
	import { editorMetaData } from '$lib/stores/editor.store.svelte';

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
</script>

<aside>
	<input class="file-name" bind:value={editorMetaData.fileName} />
	<input class="search-bar" bind:value={searchBar} placeholder="Search..." />

	<NodeContainer
		heading="Basic Shapes"
		nodes={filteredShapes}
	/>
</aside>

<style>
    aside {
        width: 300px;
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