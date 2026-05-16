<script lang="ts">
	import { Handle, Position, NodeResizer, useSvelteFlow, type NodeProps } from '@xyflow/svelte';

	let { id, data, selected, isConnectable }: NodeProps = $props();
	let { updateNodeData } = useSvelteFlow();

	function onInput(evt: Event) {
		const target = evt.target as HTMLInputElement;
		updateNodeData(id, { label: target.value });
	}
</script>

<div class="rectangle-node">
	<NodeResizer
		isVisible={selected}
		minWidth={60}
		minHeight={30}
	/>

	<Handle type="source" position={Position.Top} {isConnectable} id="top" />
	<Handle type="source" position={Position.Right} {isConnectable} id="right" />
	<Handle type="source" position={Position.Bottom} {isConnectable} id="bottom" />
	<Handle type="source" position={Position.Left} {isConnectable} id="left" />

	<div class="node-text">
		<input
			type="text"
			value={data.label ?? ''}
			oninput={onInput}
			class="nodrag"
			placeholder="Type here..."
		>
	</div>
</div>

<style>
    input {
        appearance: none;
        -webkit-appearance: none;
        border: none;
        padding: 0;
        margin: 0;
        outline: none;
        text-align: center;
        width: 100%;
    }

    .rectangle-node {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 30px;
		width: 100%;
		height: 100%;
    }
</style>