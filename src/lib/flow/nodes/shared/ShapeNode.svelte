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
		// Diamond: the default 4 cardinal connection handles land on the bbox
		// edge midpoints — which ARE the diamond's vertices — so each vertex gets
		// a connection circle. Resize uses the default NodeResizer, whose anchors
		// sit at the 4 bbox CORNERS (red squares), matching the reference.
		DiamondNode: { kind: 'svg' },
		// Parallelogram. SVG polygon: top-left(20,1) → top-right(99,1) →
		// bottom-right(80,99) → bottom-left(1,99).
		//   TOP / BOTTOM dots sit at the midpoints of the two horizontal edges
		//     (59.5%, 40.5%) — those points ARE on the shape outline.
		//   LEFT / RIGHT dots sit on the bbox edge centres (default cardinal
		//     position) — like the triangle. The slanted side is inset ~10.5% of
		//     the width from there, so the connection layer pushes the WIRE
		//     endpoint in to the slant (see SIDE_INSET_RATIO in the edge files)
		//     while the dot marker itself stays on the bbox edge.
		// `bottom: auto` cancels xyflow's class-level edge anchor for the
		// bottom-positioned handle; the `transform` re-centres it.
		// Resize anchors use the default 4 bbox corners (matches the picture).
		ParallelogramNode: {
			kind: 'svg',
			handles: [
				{ id: 'top', position: 'top', style: 'top: 1%; left: 59.5%;' },
				{ id: 'right', position: 'right' },
				{
					id: 'bottom',
					position: 'bottom',
					style: 'top: 99%; left: 40.5%; bottom: auto; transform: translate(-50%, -50%);'
				},
				{ id: 'left', position: 'left' }
			]
		},
		// Triangle: fully default handles + resizer — 4 cardinal connection dots at
		// the bbox edge midpoints + the default 4-corner NodeResizer — so a
		// selected triangle reads exactly like the reference (red box, corner
		// squares, edge-midpoint circles).
		TriangleNode: { kind: 'svg' },
		DocumentNode: { kind: 'svg' },
		ActorNode: { kind: 'svg' },
		CubeNode: { kind: 'svg' }
	};

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
	const rounded = $derived((data.rounded as boolean) ?? false);
	const shadow = $derived((data.shadow as boolean) ?? false);

	// Border always reflects the user's colour/width — even while selected — so
	// StylePanel edits show live (like the entity node). Selection is indicated
	// by a soft red glow (see .shape-node.selected .shape-fill) + the handles,
	// not by recolouring the border.
	const strokeColor = $derived(userBorderColor);
	const strokeWidth = $derived(userBorderWidth);

	const textColor = $derived((data.textColor as string) ?? '#2c2c2a');
	const fontFamily = $derived((data.fontFamily as string) ?? 'inherit');
	const fontSize = $derived((data.fontSize as number) ?? 14);
	const bold = $derived((data.bold as boolean) ?? false);
	const italic = $derived((data.italic as boolean) ?? false);
	const underline = $derived((data.underline as boolean) ?? false);
	const textAlign = $derived((data.textAlign as string) ?? 'center');

	const labelStyle = $derived(
		[
			`color: ${textColor}`,
			`font-family: ${fontFamily}`,
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
				<!--
					Base sits at y=99 spanning 1→99 (matching diamond/parallelogram)
					so it lands on the bbox bottom edge — the same line the selection
					ring + the two bottom resize anchors sit on. Drawing it at y=97
					earlier left a ~3% gap that read as a doubled line under the base.
				-->
				<polygon
					points="50,1 99,99 1,99"
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

					The hexagon silhouette fills the bbox (extremes at 1/99), so
					its top / bottom vertices and left / right vertical edges land
					on the bbox edge midpoints — exactly where the 4 default
					cardinal handles sit. That makes the selection ring hug the
					cube and connections touch it, like the diamond. Shared
					vertices: top(50,1) upper-left(1,27) upper-right(99,27)
					centre(50,54) lower-left(1,80) lower-right(99,80) bottom(50,99).
				-->
				<polygon
					points="1,27 50,1 99,27 50,54"
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
				<polygon
					points="1,27 1,80 50,99 50,54"
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
				<polygon
					points="99,27 99,80 50,99 50,54"
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
	   intercepts the label's input. `overflow: visible` stops the SVG viewport
	   from clipping a thick, path-centred stroke (the ellipse/diamond/… outline
	   sits at the viewBox edge, so half of a wide border would otherwise be cut
	   flat at the top/right/bottom/left). */
	.shape-fill {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		overflow: visible;
	}

	/* Selection cue: a rectangular red ring around the node's bounding box, like a
	   default NodeResizer outline. box-shadow (unlike a CSS filter) isn't clipped
	   by the SVG viewport, so it works for boxed AND svg shapes with no wrapper —
	   and it sits outside the node's own border, so the user's border colour/width
	   stays visible and live-editable while selected. */
	.shape-node.selected .shape-fill {
		box-shadow: 0 0 0 2px #a6192e;
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
	/* Must out-specify xyflow's `.svelte-flow__handle` (width/height: 6px) or the
	   size below is ignored — two classes (0,2,0) beats the library's (0,1,0). */
	:global(.svelte-flow__handle.shape-conn) {
		width: 10px;
		height: 10px;
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
	/* Selector must out-specify xyflow's `.svelte-flow__resize-control.handle`
	   (which hard-codes width/height: 5px), or the size below is ignored. Adding
	   the two library classes makes this rule (0,3,0) > the library's (0,2,0). */
	:global(.svelte-flow__resize-control.handle.shape-resize-anchor) {
		width: 15px;
		height: 15px;
		background: #ffffff;
		border: 2px solid #a6192e;
		border-radius: 4px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
	}

	/* Edge resize strips. Kept visually invisible, but widened to an 8px hit
	   area straddling each side, so hovering near an edge flips to the ↔ / ↕
	   resize cursor and lets you drag that side — not just the corners. The
	   extra library classes out-specify xyflow's `.line` / `.line.left` rules
	   (which pin the colour and a 1px width). */
	:global(.svelte-flow__resize-control.line.shape-resize-line) {
		border-color: transparent;
		background: transparent;
	}
	:global(.svelte-flow__resize-control.line.left.shape-resize-line),
	:global(.svelte-flow__resize-control.line.right.shape-resize-line) {
		width: 8px;
	}
	:global(.svelte-flow__resize-control.line.top.shape-resize-line),
	:global(.svelte-flow__resize-control.line.bottom.shape-resize-line) {
		height: 8px;
	}
</style>
