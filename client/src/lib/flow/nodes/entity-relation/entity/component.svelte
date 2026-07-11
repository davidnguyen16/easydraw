<script lang="ts">
	import { Handle, Position, NodeResizer, useSvelteFlow, type NodeProps } from '@xyflow/svelte';
	import { toFiniteRotation } from '$lib/flow/nodes/style-utils';
	import { resolveFieldKey, type EntityData } from './types';

	let { id, data, selected }: NodeProps = $props();
	let entity = $derived(data as unknown as EntityData);

	const { updateNodeData } = useSvelteFlow();

	function commit(patch: Partial<EntityData>) {
		if (entity.onEdit) entity.onEdit(patch);
		else updateNodeData(id, patch);
	}

	function setLabel(value: string) {
		commit({ label: value });
	}

	function setFieldName(index: number, value: string) {
		commit({
			fields: entity.fields.map((field, i) =>
				i === index ? { ...field, name: value } : field
			)
		});
	}

	// Style overrides from StylePanel. Anything left undefined keeps the
	// entity's built-in defaults (white card, white header, dark title).
	// fillColor is intentionally scoped to the header only.
	const opacity = $derived(Math.max(0, Math.min(100, Number(entity.opacity ?? 100))));
	const visualOpacity = $derived(Number.isFinite(opacity) ? opacity / 100 : 1);
	const borderColor = $derived(entity.borderColor ?? '#373a36');
	const borderWidth = $derived(entity.borderWidth ?? 1);
	const cardRadius = $derived(entity.rounded === false ? '0' : '4px');
	const rotation = $derived(toFiniteRotation(entity.rotation));

	// Rotation lives on the ROOT div (like ShapeNode's container) so the
	// selection ring, resize anchors and connection handles — all children of
	// the root — rotate together with the card instead of staying axis-aligned
	// while the card turns underneath them.
	const rootStyle = $derived(
		[
			`transform: rotate(${rotation}deg)`,
			'transform-origin: center',
			'transition: transform 120ms ease'
		].join('; ')
	);

	const cardStyle = $derived(
		[
			entity.borderColor ? `border-color: ${entity.borderColor}` : '',
			entity.borderWidth !== undefined ? `border-width: ${entity.borderWidth}px` : '',
			entity.rounded !== undefined ? `border-radius: ${entity.rounded ? '4px' : '0'}` : '',
			entity.shadow ? 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)' : '',
			`opacity: ${visualOpacity}`,
			'transition: box-shadow 150ms ease'
		]
			.filter(Boolean)
			.join('; ')
	);

	const weakInnerBorderStyle = $derived(
		[
			`inset: ${Math.max(3, borderWidth + 2)}px`,
			`border-color: ${borderColor}`,
			`border-width: ${borderWidth}px`,
			`border-radius: ${cardRadius === '0' ? '0' : '2px'}`
		].join('; ')
	);

	const headerStyle = $derived(entity.fillColor ? `background-color: ${entity.fillColor}` : '');

	const titleStyle = $derived(
		[
			entity.textColor ? `color: ${entity.textColor}` : '',
			entity.fontFamily ? `font-family: ${entity.fontFamily}` : '',
			entity.fontSize ? `font-size: ${entity.fontSize}px` : '',
			entity.bold !== undefined ? `font-weight: ${entity.bold ? '700' : '500'}` : '',
			entity.italic ? 'font-style: italic' : '',
			entity.underline ? 'text-decoration: underline' : '',
			entity.textAlign ? `text-align: ${entity.textAlign}` : ''
		]
			.filter(Boolean)
			.join('; ')
	);

	// Field name text follows the same color/font choice for visual consistency.
	const fieldNameStyle = $derived(
		[
			entity.textColor ? `color: ${entity.textColor}` : '',
			entity.fontFamily ? `font-family: ${entity.fontFamily}` : ''
		]
			.filter(Boolean)
			.join('; ')
	);

	// Per-key badge colours — mirror the FieldsPanel palette 1:1 (was the
	// `.badge[data-key='…']` attribute selectors). Keyed lookup keeps the
	// markup to one class binding instead of four data-attribute rules.
	const BADGE_CLASS: Record<string, string> = {
		PK: 'bg-[#fae9c8] text-[#854f0b]',
		FK: 'bg-[#dce9fa] text-[#1e4380]',
		PI: 'bg-[#c8eae0] text-[#0b6354]',
		WPI: 'bg-[#e3d8fa] text-[#5a3fb0]'
	};

	// ─── Double-click to edit (title + each field), like connection labels ──
	// At rest every input is read-only and ignores the pointer, so a single click
	// just selects the node. `editingKey` marks which one (`'title'` or
	// `'field:<i>'`) is currently editable; only a double-click on its row sets it.
	let editingKey = $state<string | null>(null);

	function startEdit(key: string) {
		editingKey = key;
	}

	function endEdit(evt?: FocusEvent) {
		editingKey = null;
		// Chromium keeps painting the last selection highlight after a blur
		// triggered while xyflow preventDefault()ed the outside click — clear
		// both the input's range and any document selection explicitly (see
		// ShapeNode.onLabelBlur).
		const input = evt?.currentTarget;
		if (input instanceof HTMLInputElement) input.setSelectionRange(0, 0);
		window.getSelection()?.removeAllRanges();
	}

	function onFieldKeydown(evt: KeyboardEvent) {
		evt.stopPropagation(); // keep keys out of xyflow's global shortcuts
		if ((evt.key === 'Enter' && !evt.shiftKey) || evt.key === 'Escape') {
			evt.preventDefault();
			(evt.currentTarget as HTMLInputElement).blur(); // → endEdit
		}
	}

	// Focus + select the input the moment its row becomes editable.
	function editable(node: HTMLInputElement, active: boolean) {
		const apply = (on: boolean) => {
			if (on) requestAnimationFrame(() => (node.focus(), node.select()));
		};
		apply(active);
		return { update: apply };
	}

	// Clicking outside the node deselects it, but xyflow's pane handler
	// preventDefault()s the pointerdown so the browser never moves focus —
	// the editing input (and its select() highlight) would stay stuck.
	// The focused element IS the editing input (the `editable` action put
	// focus there), so blur it; that runs endEdit via the input's onblur.
	$effect(() => {
		if (editingKey !== null && !selected) {
			(document.activeElement as HTMLElement | null)?.blur();
		}
	});

	// Belt and braces for every other "click away" (canvas pan-start, another
	// row of this same entity, toolbar…): while editing, ANY pointerdown
	// outside the focused input ends the edit. Capture phase, so it runs
	// before xyflow's handlers and can't be stopped by them.
	$effect(() => {
		if (editingKey === null) return;
		const onPointerDown = (e: PointerEvent) => {
			const active = document.activeElement;
			if (
				active instanceof HTMLElement &&
				e.target instanceof Node &&
				active !== e.target &&
				!active.contains(e.target)
			) {
				active.blur();
			}
		};
		window.addEventListener('pointerdown', onPointerDown, true);
		return () => window.removeEventListener('pointerdown', onPointerDown, true);
	});
</script>

<!--
	Two-layer structure (matches ../../ShapeNode.svelte):
	  root  → group + relative positioning wrapper; handles/resizer anchor to
	          its edges and aren't clipped. `group` + `active` class drive the
	          hover / selected reveal below.
	  card  → the visible card; owns overflow-hidden so header + rows respect
	          the rounded corners. The `entity-card` class is a cross-component
	          DOM hook (ConnectionEdge's snap-target rule shadows it) — keep it.
-->
<div
	class="group relative h-full w-full min-w-[180px] min-h-[80px]"
	class:active={selected}
	style={rootStyle}
>
	<div
		class="entity-card relative flex h-full w-full flex-col overflow-hidden rounded-[4px] border
			border-[#373a36] bg-white font-sans shadow-[0_2px_6px_rgba(0,0,0,0.06)] transition-shadow
			duration-150 group-hover:shadow-[0_4px_12px_rgba(166,25,46,0.15)]
			group-[.active]:shadow-[0_4px_12px_rgba(166,25,46,0.15)]"
		style={cardStyle}
	>
		{#if entity.weak}
			<span
				class="pointer-events-none absolute z-10 border"
				style={weakInnerBorderStyle}
				aria-hidden="true"
			></span>
		{/if}

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<header
			class="border-b border-[#373a36] px-3 py-2 text-center select-none"
			style={headerStyle}
			ondblclick={(e) => {
				e.stopPropagation();
				startEdit('title');
			}}
		>
			<input
				class="nodrag w-full border-none bg-transparent p-0 text-center text-[13px] font-medium
					text-ink outline-none placeholder:text-[rgba(44,44,42,0.45)]
					{editingKey === 'title'
					? 'pointer-events-auto cursor-text select-text'
					: 'pointer-events-none cursor-[inherit]'}"
				type="text"
				value={entity.label ?? ''}
				spellcheck="false"
				readonly={editingKey !== 'title'}
				use:editable={editingKey === 'title'}
				oninput={(event) => setLabel(event.currentTarget.value)}
				onkeydown={onFieldKeydown}
				onblur={endEdit}
				style={titleStyle}
			/>
		</header>

		<ul class="m-0 flex list-none flex-col p-0 select-none">
			{#each entity.fields as field, index}
				{@const key = resolveFieldKey(field)}
				{@const editKey = `field:${index}`}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<li
					class="flex items-center border-t-[0.5px] border-line px-3 py-2
						first:border-t first:border-[#373a36]"
					ondblclick={(e) => {
						e.stopPropagation();
						startEdit(editKey);
					}}
				>
					<span class="mr-2 inline-flex min-w-[36px] flex-shrink-0 items-center gap-1">
						{#if key}
							<span
								class="{BADGE_CLASS[key] ??
									''} inline-block rounded-[2px] px-[5px] py-px text-[10px] font-semibold leading-[1.4]"
								>{key}</span
							>
						{/if}
					</span>
					<input
						class="nodrag min-w-0 flex-1 border-none bg-transparent p-0 text-[12px] text-ink-soft
							outline-none {key === 'PK' ? 'font-medium' : ''}
							{editingKey === editKey
							? 'pointer-events-auto cursor-text select-text'
							: 'pointer-events-none cursor-[inherit]'}"
						type="text"
						value={field.name}
						spellcheck="false"
						readonly={editingKey !== editKey}
						use:editable={editingKey === editKey}
						oninput={(event) => setFieldName(index, event.currentTarget.value)}
						onkeydown={onFieldKeydown}
						onblur={endEdit}
						style={fieldNameStyle}
					/>
					<!-- Field type rendering is gated by the panel's master
                         toggle — "physical" mode shows it, "conceptual" hides
                         it even if a type was previously set. -->
					{#if entity.showDataTypes && field.type}
						<span
							class="ml-2 flex-shrink-0 text-right text-[11px] tracking-[0.02em] text-[#888] uppercase"
							>{field.type.toUpperCase()}</span
						>
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	<NodeResizer
		isVisible={selected}
		minWidth={180}
		minHeight={80}
		handleClass="entity-resize-anchor"
		lineClass="entity-resize-line"
	/>

	<!--
		The four cardinal handles. Size/paint stays in :global CSS below (it must
		out-specify xyflow's own `.svelte-flow__handle`), but the hover/selected
		REVEAL is Tailwind here, driven by the root's `group` + `active` class.
	-->
	{#each [Position.Top, Position.Right, Position.Bottom, Position.Left] as pos (pos)}
		<Handle
			type="source"
			position={pos}
			id={pos}
			class="entity-handle pointer-events-none opacity-0 transition-opacity duration-[120ms]
				group-hover:pointer-events-auto group-hover:opacity-100
				group-[.active]:pointer-events-auto group-[.active]:opacity-100"
		/>
	{/each}
</div>

<style>
	/*
	 * Only xyflow-DOM overrides remain here — they reach the library's own
	 * `.svelte-flow__handle` / `.svelte-flow__resize-control` elements via
	 * :global and must out-specify its built-in sizes, so they can't be
	 * utility classes. Everything else (card, header, rows, badges, reveal)
	 * is now Tailwind in the template above.
	 */

	/* Cardinal connection handle — 10px white dot, red ring (the reveal
	   opacity/pointer-events live on the element as utilities). */
	:global(.svelte-flow__handle.entity-handle) {
		width: 10px;
		height: 10px;
		background: #ffffff;
		border: 1.5px solid #a6192e;
		border-radius: 50%;
	}

	/* NodeResizer corner anchors — 15px white square, red ring, soft shadow.
	   The three-class selector out-specifies xyflow's `.handle` (5px). */
	:global(.svelte-flow__resize-control.handle.entity-resize-anchor) {
		width: 15px;
		height: 15px;
		background: #ffffff;
		border: 2px solid #a6192e;
		border-radius: 4px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
	}

	/* Hide the edge-line resize handles; spec calls for corner anchors only. */
	:global(.entity-resize-line) {
		border-color: transparent;
		background: transparent;
	}
</style>
