<script lang="ts">
	/**
	 * Connection anchor host — see anchor.ts for the why.
	 *
	 * Renders NOTHING visible. It exists only so a floating edge endpoint has a
	 * real node + handle to resolve its position from (xyflow edges must point at
	 * a real node). The visible endpoint dot — and the grab-to-drag affordance —
	 * is drawn by the EDGE itself (EndpointHandle in ConnectionEdge) and only on
	 * hover / selection. So at rest a free wire end is just a clean line ending in
	 * space, with no stray dot left floating on the canvas.
	 *
	 * The handle stays in the DOM (fully transparent) purely so xyflow can measure
	 * its bounds and place the endpoint at the anchor's centre. The whole node is
	 * `pointer-events: none` so it never steals a grab from the edge's endpoint
	 * handle below it in the z-order — all endpoint interaction lives on the edge.
	 */
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { ANCHOR_HANDLE_ID } from './anchor';

	// The anchor draws nothing and reads no data, but must still accept NodeProps
	// to type as a valid xyflow node component.
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

	/* The anchor node is purely a position host — never an interaction target.
	   Endpoint grabbing happens on the edge's EndpointHandle (one z-layer below),
	   so NOTHING in the anchor subtree may intercept the pointer — otherwise the
	   invisible 12×12 node box steals the grab over the dot's centre (cursor
	   flickers, drag dies in the middle). `!important` + the whole subtree (`*`)
	   because the theme's `.svelte-flow__node { pointer-events: all }` would
	   otherwise win on load order, and a child could re-enable it. The dedicated
	   `connection-anchor-node` class (set in createAnchorNode) is used so the rule
	   can't be missed by a class-name mismatch. */
	:global(.connection-anchor-node),
	:global(.connection-anchor-node *) {
		pointer-events: none !important;
	}

	/*
     * Invisible handle, centred on the node (= the wire end). No fill or border:
     * it's just a measurable anchor point for the edge endpoint. The two-class
     * selector outranks the theme's `.svelte-flow__handle-top` rule so the
     * centring transform wins (otherwise the handle sits at the box top and the
     * endpoint is offset from the actual wire end).
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
		background: transparent;
		border: none;
		box-sizing: border-box;
	}
</style>
