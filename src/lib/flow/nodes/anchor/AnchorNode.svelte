<script lang="ts">
	/**
	 * Visual for a connection anchor — see anchor.ts for the why.
	 *
	 * A single small WHITE circle that marks the free wire end. There is no
	 * second marker: the circle IS the handle, centred on the endpoint, so the
	 * edge resolves its endpoint exactly to the wire end (which also keeps the
	 * released edge lined up with the drag preview).
	 *
	 * The handle is `isConnectable={false}` ON PURPOSE: an anchor is the
	 * passive host for an existing edge endpoint, NOT a connection point — you
	 * must not be able to start a brand-new connection from a floating wire.
	 * Being non-connectable it gets the theme's `pointer-events: none`, so a
	 * click falls through to the draggable node body and just repositions the
	 * end (the white circle "drags" the wire, no extra affordance needed).
	 */
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { ANCHOR_HANDLE_ID } from './anchor';

	let { selected }: NodeProps = $props();
</script>

<div class="anchor" class:selected>
	<Handle
		type="source"
		position={Position.Top}
		id={ANCHOR_HANDLE_ID}
		class="anchor-handle"
		isConnectable={false}
	/>
</div>

<style>
	.anchor {
		position: relative;
		width: 100%;
		height: 100%;
	}

	/*
     * Small white circle, centred on the node (= the wire end). The
     * two-class selector (`.svelte-flow__handle.anchor-handle`) outranks the
     * theme's `.svelte-flow__handle-top` rule so the centring transform wins —
     * without it the handle would sit at the box top and the edge endpoint
     * would be offset from the drop point.
     */
	:global(.svelte-flow__handle.anchor-handle) {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 9px;
		height: 9px;
		min-width: 9px;
		min-height: 9px;
		background: #ffffff;
		border: 1.5px solid #9b9991;
		border-radius: 50%;
		box-sizing: border-box;
	}

	.anchor:hover :global(.svelte-flow__handle.anchor-handle),
	.anchor.selected :global(.svelte-flow__handle.anchor-handle) {
		border-color: #a6192e;
	}
</style>
