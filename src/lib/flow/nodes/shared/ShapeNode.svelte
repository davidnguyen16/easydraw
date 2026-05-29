<script module lang="ts">
	/**
	 * Per-shape declarative config — the single place that says "what does
	 * this shape look like, and where does its label go". Adding a new basic
	 * shape is two steps: append a VARIANTS row, and (if it's a custom path)
	 * add the SVG markup in the {#if} switch below. No other code path knows
	 * about specific node types.
	 *
	 *   kind:
	 *     'boxed'     → renders as a styled <div>: border, fill, border-radius.
	 *                   Use for shapes whose corner radius matters at all
	 *                   aspect ratios (preserveAspectRatio="none" distorts SVG
	 *                   rx values).
	 *     'svg'       → renders as an SVG path; preserveAspectRatio="none" so
	 *                   it stretches to fill any node size.
	 *     'text-only' → no shape outline at all; bare label container.
	 *
	 *   boxRadius:    CSS border-radius for 'boxed' shapes.
	 *
	 * Default (unselected) stroke and selected (#A6192E) stroke are applied
	 * uniformly across both kinds in the template below.
	 */
	type ShapeKind = 'boxed' | 'svg' | 'text-only';

	interface Variant {
		kind: ShapeKind;
		boxRadius?: string;
	}

	export const VARIANTS: Record<string, Variant> = {
		RectangleNode: { kind: 'boxed', boxRadius: '6px' },
		RoundedRectangleNode: { kind: 'boxed', boxRadius: '14px' },
		PillNode: { kind: 'boxed', boxRadius: '9999px' },
		TextNode: { kind: 'text-only' },
		EllipseNode: { kind: 'svg' },
		CircleNode: { kind: 'svg' },
		DiamondNode: { kind: 'svg' },
		ParallelogramNode: { kind: 'svg' },
		TriangleNode: { kind: 'svg' },
		DocumentNode: { kind: 'svg' },
		ActorNode: { kind: 'svg' },
		CubeNode: { kind: 'svg' }
	};

	/** Selected stroke colour (MQ red) — applies to both boxed and svg shapes. */
	export const SELECTED_STROKE = '#A6192E';
	export const SELECTED_STROKE_WIDTH = 1.5;
</script>

<script lang="ts">
	import {
		Handle,
		Position,
		NodeResizer,
		useSvelteFlow,
		type NodeProps
	} from '@xyflow/svelte';

	let { id, type, data, selected, isConnectable }: NodeProps = $props();
	let { updateNodeData } = useSvelteFlow();

	const variant = $derived<Variant>(
		VARIANTS[type ?? ''] ?? { kind: 'svg' }
	);

	// Style fields populated by StylePanel. Defaults match the design ref:
	// white fill, black 1.5px border, dark text. Selected state always
	// overrides the user's border colour with the MQ-red selection accent so
	// it's unmistakable what's in focus regardless of customisation.
	const fillColor = $derived((data.fillColor as string) ?? '#ffffff');
	const userBorderColor = $derived((data.borderColor as string) ?? '#2c2c2a');
	const userBorderWidth = $derived((data.borderWidth as number) ?? 1.5);
	const rounded = $derived((data.rounded as boolean) ?? true);
	const shadow = $derived((data.shadow as boolean) ?? false);

	const strokeColor = $derived(selected ? SELECTED_STROKE : userBorderColor);
	const strokeWidth = $derived(selected ? SELECTED_STROKE_WIDTH : userBorderWidth);

	const textColor = $derived((data.textColor as string) ?? '#2c2c2a');
	const fontSize = $derived((data.fontSize as number) ?? 14);
	const bold = $derived((data.bold as boolean) ?? false);
	const italic = $derived((data.italic as boolean) ?? false);
	const underline = $derived((data.underline as boolean) ?? false);
	const textAlign = $derived((data.textAlign as string) ?? 'center');

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

	// `rounded=false` only turns off the corner radius for plain Rectangle —
	// RoundedRectangle and Pill are defined by their rounding so they ignore
	// the flag.
	const boxedRadius = $derived(
		type === 'RectangleNode' && rounded === false
			? '0'
			: (variant.boxRadius ?? '0')
	);

	const boxedStyle = $derived(
		variant.kind === 'boxed'
			? [
					`background-color: ${fillColor}`,
					`border: ${strokeWidth}px solid ${strokeColor}`,
					`border-radius: ${boxedRadius}`
				].join('; ')
			: ''
	);

	const containerFilter = $derived(
		shadow ? 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.18))' : 'none'
	);

	function onInput(evt: Event) {
		const target = evt.target as HTMLInputElement;
		updateNodeData(id, { label: target.value });
	}
</script>

<!--
	.shape-node fills the xyflow wrapper edge-to-edge (the theme override in
	xy-theme.css strips the wrapper's padding, so width/height: 100% gives the
	true bounding box). Handles position absolutely against this container,
	which puts them exactly on the shape edge — no gap.
-->
<div
	class="shape-node"
	class:selected
	style="filter: {containerFilter};"
>
	<!--
		DOM order matters for stacking: paint the shape fill FIRST so that
		the connection handles + resize anchors render on top of it. Without
		this, the inside half of each circular handle gets painted over by
		the fill (white div / SVG) and you only see the outside half — the
		"only half visible" symptom.
	-->
	{#if variant.kind === 'boxed'}
		<div class="shape-fill" style={boxedStyle}></div>
	{:else if variant.kind === 'svg'}
		<svg
			class="shape-fill"
			preserveAspectRatio="none"
			viewBox="0 0 100 100"
			aria-hidden="true"
		>
			{#if type === 'EllipseNode' || type === 'CircleNode'}
				<ellipse
					cx="50"
					cy="50"
					rx="49.5"
					ry="49.5"
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					vector-effect="non-scaling-stroke"
				/>
			{:else if type === 'DiamondNode'}
				<polygon
					points="50,1 99,50 50,99 1,50"
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			{:else if type === 'ParallelogramNode'}
				<polygon
					points="20,1 99,1 80,99 1,99"
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			{:else if type === 'TriangleNode'}
				<polygon
					points="50,3 97,97 3,97"
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			{:else if type === 'DocumentNode'}
				<path
					d="M1,1 L99,1 L99,82 Q75,108 50,82 T1,82 Z"
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			{:else if type === 'ActorNode'}
				<circle cx="50" cy="18" r="13" fill={fillColor} stroke={strokeColor} stroke-width={strokeWidth} vector-effect="non-scaling-stroke" />
				<line x1="50" y1="31" x2="50" y2="68" stroke={strokeColor} stroke-width={strokeWidth} vector-effect="non-scaling-stroke" />
				<line x1="22" y1="46" x2="78" y2="46" stroke={strokeColor} stroke-width={strokeWidth} vector-effect="non-scaling-stroke" />
				<line x1="50" y1="68" x2="28" y2="98" stroke={strokeColor} stroke-width={strokeWidth} vector-effect="non-scaling-stroke" />
				<line x1="50" y1="68" x2="72" y2="98" stroke={strokeColor} stroke-width={strokeWidth} vector-effect="non-scaling-stroke" />
			{:else if type === 'CubeNode'}
				<polygon points="2,30 50,5 98,30 50,55" fill={fillColor} stroke={strokeColor} stroke-width={strokeWidth} stroke-linejoin="round" vector-effect="non-scaling-stroke" />
				<polygon points="2,30 2,80 50,98 50,55" fill={fillColor} stroke={strokeColor} stroke-width={strokeWidth} stroke-linejoin="round" vector-effect="non-scaling-stroke" />
				<polygon points="98,30 98,80 50,98 50,55" fill={fillColor} stroke={strokeColor} stroke-width={strokeWidth} stroke-linejoin="round" vector-effect="non-scaling-stroke" />
			{/if}
		</svg>
	{/if}

	<NodeResizer
		isVisible={selected}
		minWidth={variant.kind === 'text-only' ? 40 : 60}
		minHeight={variant.kind === 'text-only' ? 24 : 30}
		handleClass="shape-resize-anchor"
		lineClass="shape-resize-line"
	/>

	<Handle type="source" position={Position.Top} {isConnectable} id="top" class="shape-conn" />
	<Handle type="source" position={Position.Right} {isConnectable} id="right" class="shape-conn" />
	<Handle type="source" position={Position.Bottom} {isConnectable} id="bottom" class="shape-conn" />
	<Handle type="source" position={Position.Left} {isConnectable} id="left" class="shape-conn" />

	<div class="node-text">
		<input
			type="text"
			value={data.label ?? ''}
			oninput={onInput}
			class="nodrag"
			placeholder={variant.kind === 'text-only' ? 'Text' : 'Type here...'}
			style={labelStyle}
		/>
	</div>
</div>

<style>
	.shape-node {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}

	/* The shape fill (boxed div or svg) sits behind the text. inset:0 +
	   pointer-events:none means it stretches with the bounding box and never
	   intercepts the label's input. */
	.shape-fill {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.node-text {
		position: relative;
		width: 100%;
		padding: 8px 12px;
		box-sizing: border-box;
		pointer-events: auto;
	}

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

	/*
	 * Connection handles — 4 cardinal circles on the bounding-box edges.
	 *
	 * Hidden until the node is selected so the canvas stays uncluttered.
	 * The xyflow handle CSS already centres them on the edge with
	 * translate(-50%, -50%); because the wrapper has zero padding (set in
	 * xy-theme.css) and .shape-node fills it edge-to-edge, "on the edge" is
	 * also "on the shape" for box/ellipse/circle/diamond — for triangle and
	 * parallelogram the cardinal points still mark the bounding box, which
	 * is the conventional connection target.
	 */
	:global(.shape-conn) {
		width: 12px;
		height: 12px;
		background: #ffffff;
		border: 1.5px solid #A6192E;
		border-radius: 50%;
		opacity: 0;
		transition: opacity 0.12s ease;
		pointer-events: none;
	}

	.shape-node:hover :global(.shape-conn),
	.shape-node.selected :global(.shape-conn) {
		opacity: 1;
		pointer-events: all;
	}

	/*
	 * Resize handles — solid MQ-red corner squares.
	 *
	 * `shape-resize-line` zeroes out NodeResizer's edge lines so only the 4
	 * corner anchors render, matching the design reference. Edge resize is
	 * still functional via the corners; we trade off some flexibility for
	 * visual clarity.
	 */
	:global(.shape-resize-anchor) {
		width: 8px;
		height: 8px;
		background: #A6192E;
		border: none;
		border-radius: 1px;
	}

	:global(.shape-resize-line) {
		border-color: transparent;
		background: transparent;
	}
</style>
