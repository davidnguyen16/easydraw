<script lang="ts">
	import { useEdges, useNodes, useSvelteFlow } from '@xyflow/svelte';
	import { nanoid } from 'nanoid';

	let {
		id,
		top,
		left,
		right,
		bottom,
		onclick
	}: {
		id: string;
		top: number | undefined;
		left: number | undefined;
		right: number | undefined;
		bottom: number | undefined;
		onclick: () => void;
	} = $props();

	const { deleteElements } = useSvelteFlow();

	const nodes = useNodes();

	function duplicateNode() {
		const node = nodes.current.find((node) => node.id === id);
		if (node) {
			nodes.current = [
				...nodes.current,
				{
					...node,
					id: nanoid(),
					position: {
						x: node.position.x,
						y: node.position.y + 100
					}
				}
			];
		}
	}

	function deleteNode() {
		deleteElements({ nodes: [{ id }] });
	}
</script>

<div
	role="button"
	tabindex="0"
	style="top: {top}px; left: {left}px; right: {right}px; bottom: {bottom}px;"
	class="context-menu"
	{onclick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.stopPropagation();
		}
	}}
	onpointerdown={(e) => e.stopPropagation()}
>
	<p style="margin: 0.5em;">
		<small>Edit Node:</small>
	</p>
	<span class="button-list">
		<button onclick={duplicateNode}>Duplicate</button>
		<button onclick={deleteNode}>Delete</button>
	</span>
</div>

<style>
	small {
		font-weight: 700;
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		color: #8a8b83;
		text-transform: uppercase;
	}

	.context-menu {
		background: #ffffff;
		border: 1px solid #d6d2c4;
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.1);
		position: absolute;
		z-index: 10;
		border-radius: 10px;
		padding: 4px;
		min-width: 140px;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
	}

	button:last-child {
		border-radius: 0 0 7px 7px;
	}

	.context-menu button {
		border: none;
		display: block;
		padding: 8px 12px;
		text-align: left;
		width: 100%;
		border-radius: 6px;
		background: transparent;
		color: #373a36;
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
		outline: inherit;
		transition:
			background 0.1s ease,
			color 0.1s ease;
	}

	.context-menu button:hover {
		background: #edebe5;
		color: #2c2c2a;
	}
</style>
