<script lang="ts">
	import { Handle, Position, NodeResizer, useSvelteFlow, type NodeProps } from '@xyflow/svelte';

	let { id, data, selected, isConnectable }: NodeProps = $props();
	let { updateNodeData } = useSvelteFlow();

	// Style fields are populated by StylePanel; defaults match a plain white box.
	const fillColor = $derived((data.fillColor as string) ?? '#ffffff');
	const borderColor = $derived((data.borderColor as string) ?? '#2c2c2a');
	const borderWidth = $derived((data.borderWidth as number) ?? 1);
	const rounded = $derived((data.rounded as boolean) ?? true);
	const shadow = $derived((data.shadow as boolean) ?? false);

	const textColor = $derived((data.textColor as string) ?? '#2c2c2a');
	const fontSize = $derived((data.fontSize as number) ?? 14);
	const bold = $derived((data.bold as boolean) ?? false);
	const italic = $derived((data.italic as boolean) ?? false);
	const underline = $derived((data.underline as boolean) ?? false);
	const textAlign = $derived((data.textAlign as string) ?? 'center');

	const containerStyle = $derived(
		[
			`background-color: ${fillColor}`,
			`border: ${borderWidth}px solid ${borderColor}`,
			`border-radius: ${rounded ? '8px' : '0'}`,
			shadow ? 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)' : ''
		]
			.filter(Boolean)
			.join('; ')
	);

	const labelStyle = $derived(
		[
			`color: ${textColor}`,
			`font-size: ${fontSize}px`,
			`font-weight: ${bold ? '700' : '400'}`,
			`font-style: ${italic ? 'italic' : 'normal'}`,
			`text-decoration: ${underline ? 'underline' : 'none'}`,
			`text-align: ${textAlign}`
		].join('; ')
	);

	function onInput(evt: Event) {
		const target = evt.target as HTMLInputElement;
		updateNodeData(id, { label: target.value });
	}
</script>

<div class="rectangle-node" style={containerStyle}>
	<NodeResizer isVisible={selected} minWidth={60} minHeight={30} />

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
			style={labelStyle}
		/>
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
		width: 100%;
		background: transparent;
		font-family: inherit;
	}

	.rectangle-node {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 30px;
		width: 100%;
		height: 100%;
		padding: 8px 12px;
		box-sizing: border-box;
		transition:
			box-shadow 0.15s ease,
			background-color 0.12s ease;
	}

	.node-text {
		width: 100%;
	}
</style>
