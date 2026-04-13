<script lang="ts">
	// Interface to define what should always be passed
	// into this component
	interface Props {
		heading: string;
		nodes: { label: string; type: string }[];
	}

	// Let these variables be props
	let { heading, nodes }: Props = $props();

	// Drag and drop behavior in the NodeContainer itself
	import { useDnD } from '$lib/flow/DnDProvider.svelte';

	const type = useDnD();

	const onDragStart = (event: DragEvent, nodeType: string) => {
		console.log('dragstart fired', nodeType);
        if (!event.dataTransfer) {
			return null;
		}

		type.current = nodeType;
		event.dataTransfer.effectAllowed = 'move';
	};
</script>

<main class="node-container">
	<h2>{heading}</h2>
	<ul>
<!--		Create a list item for each container-->
		{#each nodes as node}
			<li>
				<button type="button"
								class="node {node.label.toLowerCase()}-node"
								aria-label="Add {node.label}"
								draggable={true}
								ondragstart={(event) => onDragStart(event, node.type)}
				>
				</button>
				
			</li>
		{/each}
	</ul>
</main>

<style>
    h2 {
        font-size: 1.3rem;
    }

    ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;    
        align-items: center;
    }

    ul li {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .node-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    button {
        /*
				Source - https://stackoverflow.com/a/45890842
				Posted by Kevinleary.net, modified by community. See post 'Timeline' for change history
				Retrieved 2026-02-10, License - CC BY-SA 4.0
				*/

        background: none;
        color: inherit;
        border: none;
        padding: 0;
        font: inherit;
        cursor: pointer;
        outline: inherit;
    }

		/*
		It's saying unused cause the class is
		dynamically generated. Will need to refactor this
		to be clearer. Define the node look in the container here for now
		*/
    .rectangle-node {
        width: 80px;
        height: 40px;
        margin: 0.5rem;
        text-align: center;
        border: 1px solid #111;
        padding: 0.5rem 1rem;
        font-weight: 700;
        border-radius: 5px;
        cursor: grab;
    }

	.table-node {
        width: 60px;
        height: 50px;
        margin: 0.5rem;
        border: 1px solid #111;
        border-radius: 4px;
        background: linear-gradient(to bottom, #d1d1d1 30%, white 30%);
        cursor: grab;
        display: flex;
        flex-direction: column;
    }
</style>