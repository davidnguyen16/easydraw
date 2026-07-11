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
	import { toFiniteRotation } from '$lib/flow/nodes/style-utils';
	import { VARIANTS, SHAPE_GEOMETRY, type Variant } from './shape-geometry';

	// String → Position lookup so the VARIANTS config can stay as plain JSON-y
	// values (no enum imports inside the shape-geometry data file).
	const HANDLE_POSITION = {
		top: Position.Top,
		right: Position.Right,
		bottom: Position.Bottom,
		left: Position.Left
	} as const;

	let { id, type, data, selected, isConnectable }: NodeProps = $props();
	let { updateNodeData } = useSvelteFlow();

	const variant = $derived<Variant>(VARIANTS[type ?? ''] ?? { kind: 'svg' });

	// What to DRAW: the variant's geometry alias when set (flowchart shapes
	// reuse basic geometries), otherwise the node's own type. `type` itself
	// stays the real id — used for the VARIANTS lookup, CSS classes, and the
	// connection layer's per-type insets.
	const shapeType = $derived(variant.geometry ?? type ?? '');

	// The drawing for the resolved shapeType. Null for boxed/text-only kinds
	// (they never reach the SVG branch) and for unknown types (renders empty,
	// same as the old switch's fallthrough).
	const geometry = $derived(SHAPE_GEOMETRY[shapeType] ?? null);

	// Style fields populated by StylePanel. Defaults match the design ref:
	// white fill, black 1.5px border, dark text. Selected state always
	// overrides the user's border colour with the MQ-red selection accent so
	// it's unmistakable what's in focus regardless of customisation.
	const fillColor = $derived((data.fillColor as string) ?? '#ffffff');
	const userBorderColor = $derived((data.borderColor as string) ?? '#2c2c2a');
	const userBorderWidth = $derived((data.borderWidth as number) ?? 1.5);
	const rounded = $derived((data.rounded as boolean) ?? false);
	const shadow = $derived((data.shadow as boolean) ?? false);
	const opacity = $derived(Math.max(0, Math.min(100, Number(data.opacity ?? 100))));
	const visualOpacity = $derived(Number.isFinite(opacity) ? opacity / 100 : 1);
	const rotation = $derived(toFiniteRotation(data.rotation));

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
		shapeType === 'RectangleNode' && rounded === false ? '0' : (variant.boxRadius ?? '0')
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
	const containerStyle = $derived(
		[
			`filter: ${containerFilter}`,
			`transform: rotate(${rotation}deg)`,
			'transform-origin: center',
			'transition: transform 120ms ease'
		].join('; ')
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
		// Chromium keeps PAINTING the last selection highlight even after blur
		// here: the canvas click that took us out of editing was
		// preventDefault()ed by xyflow, so the browser never replaces the
		// selection on its own. Clear BOTH selections explicitly — the input's
		// internal range and any document selection the double-click created.
		inputEl?.setSelectionRange(0, 0);
		window.getSelection()?.removeAllRanges();
	}

	// Clicking outside the node (pane / another node) DESELECTS it, but
	// xyflow's pane handler preventDefault()s the pointerdown, so the browser
	// never moves focus off the input — the edit (and its select() highlight)
	// would stay stuck on screen. Deselection-while-editing means the user
	// clicked away, so end the edit through the normal blur path.
	$effect(() => {
		if (editing && !selected) {
			inputEl?.blur();
		}
	});

	// Belt and braces for every other "click away" (canvas pan-start, the
	// node's own body, toolbar buttons that swallow focus…): while editing,
	// ANY pointerdown outside the input ends the edit. Capture phase, so it
	// runs before xyflow's handlers and can't be stopped by their
	// preventDefault/stopPropagation.
	$effect(() => {
		if (!editing) return;
		const onPointerDown = (e: PointerEvent) => {
			if (e.target instanceof Node && inputEl && !inputEl.contains(e.target)) {
				inputEl.blur();
			}
		};
		window.addEventListener('pointerdown', onPointerDown, true);
		return () => window.removeEventListener('pointerdown', onPointerDown, true);
	});

	// Connection-handle classes. `shape-conn` is a DOM hook kept for the xyflow
	// size/paint :global rule below AND ConnectionEdge's snap-target reveal. The
	// hover/selected reveal itself is Tailwind, driven by the wrapper's `group` +
	// `selected` class (was `.shape-node:hover/.selected :global(.shape-conn)`).
	const CONN_CLASS =
		'shape-conn pointer-events-none opacity-0 transition-opacity duration-[120ms] ' +
		'group-hover:pointer-events-auto group-hover:opacity-100 ' +
		'group-[.selected]:pointer-events-auto group-[.selected]:opacity-100';
</script>

<!--
	.shape-node fills the xyflow wrapper edge-to-edge (the theme override in
	xy-theme.css strips the wrapper's padding, so width/height: 100% gives the
	true bounding box). Handles position absolutely against this container,
	which puts them exactly on the shape edge — no gap.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="group relative flex h-full min-h-[30px] w-full items-center justify-center"
	class:selected
	style={containerStyle}
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
		<div
			class="pointer-events-none absolute inset-0 h-full w-full overflow-visible
				group-[.selected]:shadow-[0_0_0_2px_#a6192e]"
			style={boxedStyle}
			style:opacity={visualOpacity}
		></div>
	{:else if variant.kind === 'svg'}
		<svg
			class="pointer-events-none absolute inset-0 h-full w-full overflow-visible
				group-[.selected]:shadow-[0_0_0_2px_#a6192e]"
			style:opacity={visualOpacity}
			preserveAspectRatio="none"
			viewBox="0 0 100 100"
			aria-hidden="true"
		>
			{#if geometry?.kind === 'ellipse'}
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
			{:else if geometry?.kind === 'polygon'}
				<polygon
					points={geometry.points}
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			{:else if geometry?.kind === 'polygons'}
				{#each geometry.items as points (points)}
					<polygon
						{points}
						fill={fillColor}
						stroke={strokeColor}
						stroke-width={strokeWidth}
						stroke-linejoin="round"
						vector-effect="non-scaling-stroke"
					/>
				{/each}
			{:else if geometry?.kind === 'path'}
				<path
					d={geometry.d}
					fill-rule={geometry.fillRule}
					fill={fillColor}
					stroke={strokeColor}
					stroke-width={strokeWidth}
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
				/>
			{:else if geometry?.kind === 'paths'}
				{#each geometry.items as item (item.d)}
					<path
						d={item.d}
						fill={item.filled === false ? 'none' : fillColor}
						stroke={strokeColor}
						stroke-width={strokeWidth}
						stroke-linejoin="round"
						vector-effect="non-scaling-stroke"
					/>
				{/each}
			{:else if geometry?.kind === 'actor'}
				<!-- Stick figure: head, torso, arms, two legs. -->
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
				class={CONN_CLASS}
				style={h.style}
			/>
		{/each}
	{:else}
		<Handle type="source" position={Position.Top} {isConnectable} id="top" class={CONN_CLASS} />
		<Handle
			type="source"
			position={Position.Right}
			{isConnectable}
			id="right"
			class={CONN_CLASS}
		/>
		<Handle
			type="source"
			position={Position.Bottom}
			{isConnectable}
			id="bottom"
			class={CONN_CLASS}
		/>
		<Handle
			type="source"
			position={Position.Left}
			{isConnectable}
			id="left"
			class={CONN_CLASS}
		/>
	{/if}

	<div
		class="pointer-events-auto relative w-full px-3 py-2 select-none"
		style:opacity={visualOpacity}
	>
		<input
			bind:this={inputEl}
			type="text"
			value={data.label ?? ''}
			oninput={onInput}
			readonly={!editing}
			onkeydown={onLabelKeydown}
			onblur={onLabelBlur}
			onpointerdown={(e) => editing && e.stopPropagation()}
			class="nodrag m-0 w-full appearance-none border-none bg-transparent p-0 outline-none
				{editing
				? 'pointer-events-auto cursor-text select-text'
				: 'pointer-events-none cursor-[inherit]'}"
			style={labelStyle}
		/>
	</div>
</div>

<style>
	/*
	 * Only xyflow-DOM overrides remain here — they target the library's own
	 * `.svelte-flow__handle` / `.svelte-flow__resize-control` via :global and
	 * must out-specify its built-in sizes, so they can't be utilities. The
	 * shape wrapper / fill / label / handle-reveal are now Tailwind in the
	 * template (wrapper = group; `group-[.selected]` drives the selection ring
	 * and handle reveal, `group-hover` the hover reveal).
	 */

	/* Connection handle dot — 10px white circle, red ring. Size/paint only; the
	   reveal opacity/pointer-events live on the element as utilities (CONN_CLASS).
	   Two classes (0,2,0) out-specify xyflow's `.svelte-flow__handle` (0,1,0). */
	:global(.svelte-flow__handle.shape-conn) {
		width: 10px;
		height: 10px;
		background: #ffffff;
		border: 1.5px solid #a6192e;
		border-radius: 50%;
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
