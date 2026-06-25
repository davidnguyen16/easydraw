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

	/**
	 * Per-shape connection-handle placement.
	 *
	 * `position` is xyflow's edge-routing hint — it tells the layout engine
	 * which direction edges should leave the handle from. `style` is an
	 * optional CSS override for cases where the visual position doesn't sit
	 * on the bbox edge centre (parallelogram slants, triangle midpoints, …).
	 * When `style` is omitted the handle sits at the default cardinal point.
	 */
	type HandleSpec = {
		id: string;
		position: 'top' | 'right' | 'bottom' | 'left';
		style?: string;
	};

	/**
	 * Per-shape resize-anchor placement.
	 *
	 * The 8 named positions come straight from xyflow's NodeResizeControl.
	 * When `resizeAnchors` is omitted on a variant, the standard NodeResizer
	 * (4 corner anchors + 4 hidden edge lines) is used instead.
	 */
	type ResizeAnchorSpec = {
		position:
			| 'top'
			| 'right'
			| 'bottom'
			| 'left'
			| 'top-left'
			| 'top-right'
			| 'bottom-left'
			| 'bottom-right';
	};

	interface Variant {
		kind: ShapeKind;
		boxRadius?: string;
		/** Custom handle placements. When omitted the default 4 cardinal
		 *  bbox-edge handles are rendered. */
		handles?: HandleSpec[];
		/** Custom resize-anchor placements (for shapes whose vertices don't
		 *  land on bbox corners — e.g. the triangle's top vertex). When
		 *  omitted, the default NodeResizer is used. */
		resizeAnchors?: ResizeAnchorSpec[];
	}

	export const VARIANTS: Record<string, Variant> = {
		RectangleNode: { kind: 'boxed', boxRadius: '6px' },
		RoundedRectangleNode: { kind: 'boxed', boxRadius: '14px' },
		PillNode: { kind: 'boxed', boxRadius: '9999px' },
		TextNode: { kind: 'text-only' },
		EllipseNode: { kind: 'svg' },
		CircleNode: { kind: 'svg' },
		// Diamond: the SVG polygon's 4 vertices sit exactly at the bbox edge
		// MIDPOINTS (top, right, bottom, left) — not at the bbox corners. So
		// the default 4 cardinal connection handles already land on the
		// vertices for free; the resize anchors are the part that needs moving
		// from the bbox corners to the same edge midpoints so each vertex ends
		// up with a coinciding circle handle inside a red square anchor, as
		// in the reference.
		DiamondNode: {
			kind: 'svg',
			resizeAnchors: [
				{ position: 'top' },
				{ position: 'right' },
				{ position: 'bottom' },
				{ position: 'left' }
			]
		},
		// Parallelogram: 4 connection handles at the MIDPOINTS of the four
		// slanted sides (not the bbox edge centres). SVG polygon points are
		// top-left(20,1) → top-right(99,1) → bottom-right(80,99) → bottom-left(1,99);
		// the side midpoints fall at (59.5,1), (89.5,50), (40.5,99), (10.5,50).
		// `right: auto` / `bottom: auto` cancel xyflow's class-level edge anchor
		// for right/bottom-positioned handles. The `transform` override flips
		// xyflow's outward translate(+50%) back to a centring translate(-50%).
		// Resize anchors use the default 4 bbox corners (matches the picture).
		ParallelogramNode: {
			kind: 'svg',
			handles: [
				{ id: 'top', position: 'top', style: 'top: 1%; left: 59.5%;' },
				{
					id: 'right',
					position: 'right',
					style: 'top: 50%; left: 89.5%; right: auto; transform: translate(-50%, -50%);'
				},
				{
					id: 'bottom',
					position: 'bottom',
					style: 'top: 99%; left: 40.5%; bottom: auto; transform: translate(-50%, -50%);'
				},
				{ id: 'left', position: 'left', style: 'top: 50%; left: 10.5%;' }
			]
		},
		// Triangle: 3 connection handles at the midpoints of the 3 sides + 3
		// resize anchors at the 3 vertices. SVG polygon points are
		// top(50,3), bottom-right(97,97), bottom-left(3,97). Side midpoints
		// fall at (26.5,50), (73.5,50), (50,97). The top vertex sits at the
		// bbox top-centre — NodeResizeControl `position: 'top'` lands there
		// naturally. Bottom-left/right vertices sit at the bbox corners.
		TriangleNode: {
			kind: 'svg',
			handles: [
				{ id: 'left', position: 'left', style: 'top: 50%; left: 26.5%;' },
				{
					id: 'right',
					position: 'right',
					style: 'top: 50%; left: 73.5%; right: auto; transform: translate(-50%, -50%);'
				},
				{
					id: 'bottom',
					position: 'bottom',
					style: 'top: 97%; left: 50%; bottom: auto; transform: translate(-50%, -50%);'
				}
			],
			resizeAnchors: [
				{ position: 'top' },
				{ position: 'bottom-left' },
				{ position: 'bottom-right' }
			]
		},
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
		NodeResizeControl,
		ResizeControlVariant,
		useSvelteFlow,
		type NodeProps
	} from '@xyflow/svelte';

	// String → Position lookup so the VARIANTS config can stay as plain JSON-y
	// values (no enum imports inside the module script).
	const HANDLE_POSITION = {
		top: Position.Top,
		right: Position.Right,
		bottom: Position.Bottom,
		left: Position.Left
	} as const;

	let { id, type, data, selected, isConnectable }: NodeProps = $props();
	let { updateNodeData } = useSvelteFlow();

	const variant = $derived<Variant>(VARIANTS[type ?? ''] ?? { kind: 'svg' });

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
		type === 'RectangleNode' && rounded === false ? '0' : (variant.boxRadius ?? '0')
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

	// ─── Label editing (double-click to type, like connection labels) ───
	// At rest the label is read-only and ignores the pointer, so a single click
	// just selects the node (xyflow). Only a double-click enters edit mode, which
	// focuses the field and lets you type; Enter / Escape / blur leaves it.
	let inputEl = $state<HTMLInputElement>();
	let editing = $state(false);

	function startEditing() {
		editing = true;
		// Wait for `readonly` to clear so focus + select actually take.
		requestAnimationFrame(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	}

	function onLabelKeydown(evt: KeyboardEvent) {
		evt.stopPropagation(); // keep keys out of xyflow's global shortcuts
		if (evt.key === 'Enter' && !evt.shiftKey) {
			evt.preventDefault();
			inputEl?.blur(); // → onLabelBlur ends editing
		} else if (evt.key === 'Escape') {
			evt.preventDefault();
			inputEl?.blur();
		}
	}

	function onLabelBlur() {
		editing = false;
	}
</script>

<!--
	.shape-node fills the xyflow wrapper edge-to-edge (the theme override in
	xy-theme.css strips the wrapper's padding, so width/height: 100% gives the
	true bounding box). Handles position absolutely against this container,
	which puts them exactly on the shape edge — no gap.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="shape-node"
	class:selected
	style="filter: {containerFilter};"
	ondblclick={(e) => {
		e.stopPropagation();
		startEditing();
	}}
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
		<svg class="shape-fill" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
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
				<!--
					Asymmetric S-curve bottom: a dip on the right side and a
					peak (hump) on the left, matching the design reference.
					`Q 75,98 50,82` dips the right half down (apex ≈ y=90);
					`T 1,82` is a SMOOTH quadratic continuation that reflects
					the previous control about (50,82) to (25,66), which lifts
					the left half UP (peak apex ≈ y=74). Both extremes stay
					well inside the 0-100 viewBox so the curve never clips.
				-->
				<path
					d="M1,1 L99,1 L99,82 Q75,98 50,82 T1,82 Z"
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			{:else if type === 'ActorNode'}
				<circle
					cx="50"
					cy="18"
					r="13"
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					vector-effect="non-scaling-stroke"
				/>
				<line
					x1="50"
					y1="31"
					x2="50"
					y2="68"
					stroke={strokeColor}
					stroke-width={strokeWidth}
					vector-effect="non-scaling-stroke"
				/>
				<line
					x1="22"
					y1="46"
					x2="78"
					y2="46"
					stroke={strokeColor}
					stroke-width={strokeWidth}
					vector-effect="non-scaling-stroke"
				/>
				<line
					x1="50"
					y1="68"
					x2="28"
					y2="98"
					stroke={strokeColor}
					stroke-width={strokeWidth}
					vector-effect="non-scaling-stroke"
				/>
				<line
					x1="50"
					y1="68"
					x2="72"
					y2="98"
					stroke={strokeColor}
					stroke-width={strokeWidth}
					vector-effect="non-scaling-stroke"
				/>
			{:else if type === 'CubeNode'}
				<!--
					3D cube faces. Like every other shape, the fill always
					follows `data.fillColor` so StylePanel colour changes show
					up immediately, even while the cube is selected. Selection
					only changes the stroke (handled centrally via strokeColor)
					— the 3-face depth still reads through the red stroke
					because each face keeps its own outline.
				-->
				<polygon
					points="2,30 50,5 98,30 50,55"
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
				<polygon
					points="2,30 2,80 50,98 50,55"
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
				<polygon
					points="98,30 98,80 50,98 50,55"
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			{/if}
		</svg>
	{/if}

	{#if variant.resizeAnchors}
		<!-- Custom resize anchors (triangle vertices, etc.). Each NodeResizeControl
		     renders one anchor; we only mount them while selected so they don't
		     paint over the shape at rest. -->
		{#if selected}
			{#each variant.resizeAnchors as anchor (anchor.position)}
				<NodeResizeControl
					position={anchor.position}
					variant={ResizeControlVariant.Handle}
					class="shape-resize-anchor"
					minWidth={60}
					minHeight={30}
				/>
			{/each}
		{/if}
	{:else}
		<NodeResizer
			isVisible={selected}
			minWidth={variant.kind === 'text-only' ? 40 : 60}
			minHeight={variant.kind === 'text-only' ? 24 : 30}
			handleClass="shape-resize-anchor"
			lineClass="shape-resize-line"
		/>
	{/if}

	{#if variant.handles}
		{#each variant.handles as h (h.id)}
			<Handle
				type="source"
				position={HANDLE_POSITION[h.position]}
				{isConnectable}
				id={h.id}
				class="shape-conn"
				style={h.style}
			/>
		{/each}
	{:else}
		<Handle type="source" position={Position.Top} {isConnectable} id="top" class="shape-conn" />
		<Handle
			type="source"
			position={Position.Right}
			{isConnectable}
			id="right"
			class="shape-conn"
		/>
		<Handle
			type="source"
			position={Position.Bottom}
			{isConnectable}
			id="bottom"
			class="shape-conn"
		/>
		<Handle
			type="source"
			position={Position.Left}
			{isConnectable}
			id="left"
			class="shape-conn"
		/>
	{/if}

	<div class="node-text" class:editing>
		<input
			bind:this={inputEl}
			type="text"
			value={data.label ?? ''}
			oninput={onInput}
			readonly={!editing}
			onkeydown={onLabelKeydown}
			onblur={onLabelBlur}
			onpointerdown={(e) => editing && e.stopPropagation()}
			class="nodrag"
			class:editing
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
		/* Read-only by default: ignore the pointer so a single click falls through
		   to the node (selects it) instead of focusing the field. Double-click on
		   .node-text flips `editing`, which re-enables typing below. */
		pointer-events: none;
		cursor: inherit;
	}

	input.editing {
		pointer-events: auto;
		cursor: text;
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
		border: 1.5px solid #a6192e;
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
		background: #a6192e;
		border: none;
		border-radius: 1px;
	}

	:global(.shape-resize-line) {
		border-color: transparent;
		background: transparent;
	}
</style>
