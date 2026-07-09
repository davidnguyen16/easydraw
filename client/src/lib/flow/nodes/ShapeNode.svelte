<script module lang="ts">
	/**
	 * Per-shape declarative config — the single place that says "what does
	 * this shape look like, and where does its label go". Adding a new shape
	 * is two DATA rows, no markup: append a VARIANTS row (behaviour: kind,
	 * handles, resize) and a SHAPE_GEOMETRY row (drawing). The template only
	 * switches on geometry KINDS (ellipse/polygon/path/…), never on node
	 * types, so it stays fixed as the catalog grows.
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
		/**
		 * Reuse another shape's drawing: the SVG switch (and the rectangle
		 * rounded-toggle) key on this instead of the node's own type. Lets a
		 * section alias a look under a new name — e.g. flowchart's
		 * DecisionNode draws the DiamondNode geometry.
		 */
		geometry?: string;
	}

	// Shared with flowchart's Data shape (same slanted body + handle spots).
	const PARALLELOGRAM_VARIANT: Variant = {
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
	};

	export const VARIANTS: Record<string, Variant> = {
		// ── basic ──────────────────────────────────────────────────────────
		RectangleNode: { kind: 'boxed', boxRadius: '6px' },
		RoundedRectangleNode: { kind: 'boxed', boxRadius: '14px' },
		// Square reuses the Rectangle boxed look (incl. the rounded toggle);
		// its identity comes from the 1:1 default drop box, like Circle.
		SquareNode: { kind: 'boxed', boxRadius: '6px', geometry: 'RectangleNode' },
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
		ParallelogramNode: PARALLELOGRAM_VARIANT,
		TrapezoidNode: { kind: 'svg' },
		// Triangle: fully default handles + resizer — 4 cardinal connection dots at
		// the bbox edge midpoints + the default 4-corner NodeResizer — so a
		// selected triangle reads exactly like the reference (red box, corner
		// squares, edge-midpoint circles).
		TriangleNode: { kind: 'svg' },
		OrthogonalTriangleNode: { kind: 'svg' },
		PolygonNode: { kind: 'svg' },
		OctagonNode: { kind: 'svg' },
		PentagonNode: { kind: 'svg' },
		HalfCircleNode: { kind: 'svg' },
		StarNode: { kind: 'svg' },
		ChevronNode: { kind: 'svg' },
		DropNode: { kind: 'svg' },
		DonutNode: { kind: 'svg' },
		CubeNode: { kind: 'svg' },
		// ── uml ────────────────────────────────────────────────────────────
		DocumentNode: { kind: 'svg' },
		ActorNode: { kind: 'svg' },
		// ── arrows ─────────────────────────────────────────────────────────
		ArrowRightNode: { kind: 'svg' },
		ArrowLeftNode: { kind: 'svg' },
		ArrowUpNode: { kind: 'svg' },
		ArrowDownNode: { kind: 'svg' },
		NotchedArrowNode: { kind: 'svg' },
		TwoWayArrowNode: { kind: 'svg' },
		QuadArrowNode: { kind: 'svg' },
		UTurnArrowNode: { kind: 'svg' },
		BendArrowNode: { kind: 'svg' },
		BendDoubleArrowNode: { kind: 'svg' },
		// ── flowchart: aliases of basic geometries under flowchart names ───
		ProcessNode: { kind: 'boxed', boxRadius: '6px', geometry: 'RectangleNode' },
		DecisionNode: { kind: 'svg', geometry: 'DiamondNode' },
		TerminatorNode: { kind: 'svg', geometry: 'EllipseNode' },
		DataNode: { ...PARALLELOGRAM_VARIANT, geometry: 'ParallelogramNode' },
		// Database cylinder. Default 4 cardinal handles land on the bbox edge
		// midpoints: top → cap apex, bottom → base apex, left/right → the
		// vertical sides. Default NodeResizer.
		DatabaseNode: { kind: 'svg' }
	};

	/**
	 * SVG drawing per shape, keyed by the RESOLVED shapeType (i.e. after the
	 * variant's `geometry` alias). The template renders by geometry KIND, so
	 * a new shape is one row here — markup never changes:
	 *
	 *   'ellipse'  → full-bbox ellipse (Ellipse / Circle)
	 *   'polygon'  → one <polygon points>
	 *   'polygons' → several filled polygons (Cube's 3 faces)
	 *   'path'     → one <path d> (+ optional fillRule, e.g. Donut's hole)
	 *   'paths'    → several paths; `filled: false` = stroke-only overlay
	 *   'actor'    → stick-figure special case (circle + 4 lines)
	 *
	 * All coordinates live in the 0-100 viewBox with extremes at 1/99 so the
	 * outline hugs the bounding box; preserveAspectRatio="none" stretches it
	 * and vector-effect keeps stroke widths true.
	 */
	type ShapeGeometry =
		| { kind: 'ellipse' }
		| { kind: 'polygon'; points: string }
		| { kind: 'polygons'; items: string[] }
		| { kind: 'path'; d: string; fillRule?: 'evenodd' }
		| { kind: 'paths'; items: { d: string; filled?: boolean }[] }
		| { kind: 'actor' };

	export const SHAPE_GEOMETRY: Record<string, ShapeGeometry> = {
		// ── basic ──────────────────────────────────────────────────────────
		EllipseNode: { kind: 'ellipse' },
		CircleNode: { kind: 'ellipse' },
		DiamondNode: { kind: 'polygon', points: '50,1 99,50 50,99 1,50' },
		ParallelogramNode: { kind: 'polygon', points: '20,1 99,1 80,99 1,99' },
		// Narrow top (25→75), full-width base.
		TrapezoidNode: { kind: 'polygon', points: '25,1 75,1 99,99 1,99' },
		// Base at y=99 spanning 1→99 so it lands on the bbox bottom edge — the
		// same line the selection ring + bottom resize anchors sit on (a base
		// drawn higher reads as a doubled line under the triangle).
		TriangleNode: { kind: 'polygon', points: '50,1 99,99 1,99' },
		// Right angle at the bottom-left; hypotenuse runs top-left → bottom-right.
		OrthogonalTriangleNode: { kind: 'polygon', points: '1,1 99,99 1,99' },
		PolygonNode: { kind: 'polygon', points: '25,1 75,1 99,50 75,99 25,99 1,50' },
		OctagonNode: { kind: 'polygon', points: '30,1 70,1 99,30 99,70 70,99 30,99 1,70 1,30' },
		PentagonNode: { kind: 'polygon', points: '50,1 99,38 80,99 20,99 1,38' },
		// Bottom half-dome: flat top on the bbox edge, elliptical arc to y=99.
		HalfCircleNode: { kind: 'path', d: 'M1,1 A49,98 0 0 0 99,1 Z' },
		StarNode: {
			kind: 'polygon',
			points: '50,2 61,38 99,38 68,60 79,96 50,74 21,96 32,60 1,38 39,38'
		},
		// Right-pointing band: tip at (99,50), matching notch cut into the left
		// edge so stacked chevrons interlock.
		ChevronNode: { kind: 'polygon', points: '1,1 75,1 99,50 75,99 1,99 25,50' },
		// Teardrop: point at the top centre, symmetric cubic flanks easing into
		// an elliptical bottom (centre y=66, ry=33 → base touches y=99).
		DropNode: { kind: 'path', d: 'M50,1 C68,28 99,38 99,66 A49,33 0 1 1 1,66 C1,38 32,28 50,1 Z' },
		// Ring: outer + inner circle as one evenodd path so the hole is a true
		// hole (canvas shows through). Each circle is two half-arcs — SVG can't
		// arc a full circle in one segment. Inner radius = 50% of outer.
		DonutNode: {
			kind: 'path',
			d: 'M1,50 A49,49 0 1 0 99,50 A49,49 0 1 0 1,50 Z M26,50 A24,24 0 1 1 74,50 A24,24 0 1 1 26,50 Z',
			fillRule: 'evenodd'
		},
		// 3D cube faces. The hexagon silhouette fills the bbox (extremes at
		// 1/99), so its top/bottom vertices and left/right vertical edges land
		// on the bbox edge midpoints — exactly where the 4 cardinal handles sit.
		// Shared vertices: top(50,1) upper-left(1,27) upper-right(99,27)
		// centre(50,54) lower-left(1,80) lower-right(99,80) bottom(50,99).
		// Each face keeps its own outline so the depth reads at any stroke.
		CubeNode: {
			kind: 'polygons',
			items: ['1,27 50,1 99,27 50,54', '1,27 1,80 50,99 50,54', '99,27 99,80 50,99 50,54']
		},
		// ── uml ────────────────────────────────────────────────────────────
		// Asymmetric S-curve bottom: `Q75,98 50,82` dips the right half down
		// (apex ≈ y=90); `T1,82` reflects the control about (50,82) to (25,66),
		// lifting the left half up (peak ≈ y=74). Both extremes stay inside the
		// viewBox so the curve never clips.
		DocumentNode: { kind: 'path', d: 'M1,1 L99,1 L99,82 Q75,98 50,82 T1,82 Z' },
		ActorNode: { kind: 'actor' },
		// ── arrows ─────────────────────────────────────────────────────────
		// Block arrow →: shaft between y=30..70, head from x=60 to the tip.
		ArrowRightNode: { kind: 'polygon', points: '1,30 60,30 60,1 99,50 60,99 60,70 1,70' },
		ArrowLeftNode: { kind: 'polygon', points: '99,30 40,30 40,1 1,50 40,99 40,70 99,70' },
		ArrowUpNode: { kind: 'polygon', points: '30,99 30,40 1,40 50,1 99,40 70,40 70,99' },
		// Mirror of ArrowUp: shaft x=30..70, head base at y=60, tip (50,99).
		ArrowDownNode: { kind: 'polygon', points: '30,1 70,1 70,60 99,60 50,99 1,60 30,60' },
		// ArrowRight silhouette + a V notch cut into the tail (vertex 15,50).
		NotchedArrowNode: {
			kind: 'polygon',
			points: '1,30 60,30 60,1 99,50 60,99 60,70 1,70 15,50'
		},
		// Heads at both ends (tips 1,50 / 99,50), shaft y=30..70 between x=25..75.
		TwoWayArrowNode: {
			kind: 'polygon',
			points: '1,50 25,1 25,30 75,30 75,1 99,50 75,99 75,70 25,70 25,99'
		},
		// Four heads on a central cross: arms x/y=43..57, head bases at 25/75
		// flaring to 35..65, tips on the bbox edge midpoints (= the 4 handles).
		QuadArrowNode: {
			kind: 'polygon',
			points:
				'50,1 65,25 57,25 57,43 75,43 75,35 99,50 75,65 75,57 57,57 57,75 65,75 50,99 35,75 43,75 43,57 25,57 25,65 1,50 25,35 25,43 43,43 43,25 35,25'
		},
		// Block U: outer bend R=37 centred (38,38) — outer top touches y=1, left
		// leg spans x=1..25, inner bend R=13, right leg x=51..75 ending in a
		// down head (base y=70, flare 43..83, tip 63,99).
		UTurnArrowNode: {
			kind: 'path',
			d: 'M1,99 L1,38 A37,37 0 0 1 75,38 L75,70 L83,70 L63,99 L43,70 L51,70 L51,38 A13,13 0 0 0 25,38 L25,99 Z'
		},
		// L bend: horizontal arm y=1..27 from the left, corner at x=75, vertical
		// arm x=49..75 dropping to a down head (flare 37..87, tip 62,99).
		BendArrowNode: { kind: 'polygon', points: '1,1 75,1 75,70 87,70 62,99 37,70 49,70 49,27 1,27' },
		// Same L bend with heads on BOTH ends: left head tip (1,27) flaring
		// y=1..53, arm band y=14..40, corner x=75, down head as BendArrow.
		BendDoubleArrowNode: {
			kind: 'polygon',
			points: '1,27 25,1 25,14 75,14 75,70 87,70 62,99 37,70 49,70 49,40 25,40 25,53'
		},
		// ── flowchart ──────────────────────────────────────────────────────
		// Database cylinder. Silhouette: vertical sides at x=1/99, top cap (back
		// rim arcs UP through 50,1) and a front-bulging base (arcs DOWN through
		// 50,99), cap/base half-height ry=12. The stroke-only overlay draws the
		// cap's FRONT rim so the top reads as a 3D ellipse lip.
		DatabaseNode: {
			kind: 'paths',
			items: [
				{ d: 'M1,13 A49,12 0 0 1 99,13 L99,87 A49,12 0 0 1 1,87 Z' },
				{ d: 'M1,13 A49,12 0 0 0 99,13', filled: false }
			]
		}
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
	import { toFiniteRotation } from '$lib/flow/nodes/style-utils';

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
