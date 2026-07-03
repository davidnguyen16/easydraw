<script lang="ts">
	import { Handle, Position, NodeResizer, useSvelteFlow, type NodeProps } from '@xyflow/svelte';
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
	const cardStyle = $derived(
		[
			entity.borderColor ? `border-color: ${entity.borderColor}` : '',
			entity.borderWidth !== undefined ? `border-width: ${entity.borderWidth}px` : '',
			entity.rounded !== undefined ? `border-radius: ${entity.rounded ? '4px' : '0'}` : '',
			entity.shadow ? 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)' : ''
		]
			.filter(Boolean)
			.join('; ')
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
    Two-layer structure (matches the basic-shape pattern in
    shared/ShapeNode.svelte):
      .entity-root  → unclipped wrapper; absolute-positioned children
                      (handles, resizer) anchor to its edges and aren't sliced.
      .entity-card  → the visible card; owns overflow:hidden so the header
                      bar respects the rounded corners and the field rows
                      don't escape the border.
    Handles + NodeResizer are SIBLINGS of .entity-card so they render after
    it in DOM (= painted on top, fully visible) and aren't clipped by
    .entity-card's overflow:hidden.
-->
<div class="entity-root" class:active={selected}>
	<div class="entity-card" style={cardStyle}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<header
			class="entity-header"
			class:editing={editingKey === 'title'}
			style={headerStyle}
			ondblclick={(e) => {
				e.stopPropagation();
				startEdit('title');
			}}
		>
			<input
				class="entity-title nodrag"
				class:editing={editingKey === 'title'}
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

		<ul class="entity-fields">
			{#each entity.fields as field, index}
				{@const key = resolveFieldKey(field)}
				{@const editKey = `field:${index}`}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<li
					class="entity-field"
					class:pk-row={key === 'PK'}
					ondblclick={(e) => {
						e.stopPropagation();
						startEdit(editKey);
					}}
				>
					<span class="badge-cell">
						{#if key}
							<span class="badge" data-key={key}>{key}</span>
						{/if}
					</span>
					<input
						class="field-name nodrag"
						class:editing={editingKey === editKey}
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
						<span class="field-type">{field.type.toUpperCase()}</span>
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

	<Handle type="source" position={Position.Top} id="top" class="entity-handle" />
	<Handle type="source" position={Position.Right} id="right" class="entity-handle" />
	<Handle type="source" position={Position.Bottom} id="bottom" class="entity-handle" />
	<Handle type="source" position={Position.Left} id="left" class="entity-handle" />
</div>

<style>
	/* Positioning wrapper. Sits flush with the xyflow bounding box so
       handles + resizer anchor exactly on the visible card's edge. No
       overflow rules here — children that extend past the edge (the
       half-outside handles) stay visible. */
	.entity-root {
		position: relative;
		width: 100%;
		height: 100%;
		min-width: 180px;
		min-height: 80px;
	}

	/* The visible card itself. Kept in NORMAL flow (not position:absolute)
       so its intrinsic content height — header + however many field rows —
       drives the wrapper's height when no explicit size is set. This is
       what makes a freshly-dropped entity show all default fields without
       having to be manually resized. */
	.entity-card {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		background: #ffffff;
		border: 1px solid #373a36;
		border-radius: 4px;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
		display: flex;
		flex-direction: column;
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif;
		overflow: hidden;
		transition: box-shadow 0.15s ease;
	}

	.entity-root:hover .entity-card,
	.entity-root.active .entity-card {
		box-shadow: 0 4px 12px rgba(166, 25, 46, 0.15);
	}

	.entity-header {
		background: #ffffff;
		padding: 8px 12px;
		border-bottom: 1px solid #373a36;
		text-align: center;
		/* Block the double-click word-select default from creating a stuck
		   DOCUMENT selection over the input (see .node-text in ShapeNode). */
		-webkit-user-select: none;
		user-select: none;
	}

	.entity-title {
		width: 100%;
		background: transparent;
		border: none;
		outline: none;
		color: #2c2c2a;
		font-weight: 500;
		font-size: 13px;
		text-align: center;
		padding: 0;
		font-family: inherit;
		/* Read-only at rest: a single click selects the node instead of focusing
		   the field. Double-click on the row flips `editing` (below). */
		pointer-events: none;
		cursor: inherit;
	}

	.entity-title.editing,
	.field-name.editing {
		pointer-events: auto;
		cursor: text;
		-webkit-user-select: text;
		user-select: text;
	}

	.entity-title::placeholder {
		color: rgba(44, 44, 42, 0.45);
	}

	.entity-fields {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		/* Same double-click document-selection guard as .entity-header. */
		-webkit-user-select: none;
		user-select: none;
	}

	.entity-field {
		display: flex;
		align-items: center;
		padding: 8px 12px;
		border-top: 0.5px solid #d6d2c4;
	}

	.entity-field:first-child {
		border-top: 1px solid #373a36;
	}

	.badge-cell {
		min-width: 36px;
		margin-right: 8px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.badge {
		padding: 1px 5px;
		border-radius: 2px;
		font-size: 10px;
		font-weight: 600;
		line-height: 1.4;
		font-family: inherit;
	}

	/* Per-key colours mirror the FieldsPanel palette so the badge on the
       canvas matches the dropdown selection 1:1. */
	.badge[data-key='PK'] {
		background: #fae9c8;
		color: #854f0b;
	}
	.badge[data-key='FK'] {
		background: #dce9fa;
		color: #1e4380;
	}
	.badge[data-key='PI'] {
		background: #c8eae0;
		color: #0b6354;
	}
	.badge[data-key='WPI'] {
		background: #e3d8fa;
		color: #5a3fb0;
	}

	.field-name {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		outline: none;
		color: #373a36;
		font-size: 12px;
		font-family: inherit;
		padding: 0;
		/* Read-only at rest (see .entity-title). */
		pointer-events: none;
		cursor: inherit;
	}

	.pk-row .field-name {
		font-weight: 500;
	}

	.field-type {
		margin-left: 8px;
		font-size: 11px;
		color: #888;
		font-family: inherit;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		flex-shrink: 0;
		text-align: right;
	}

	/* Cardinal connection handles — invisible until hover/select. Matches the
	   basic shapes' `.shape-conn` (10px white dot, red ring). The two-class
	   selector out-specifies xyflow's `.svelte-flow__handle` (6px) so the size
	   actually applies. */
	:global(.svelte-flow__handle.entity-handle) {
		width: 10px;
		height: 10px;
		background: #ffffff;
		border: 1.5px solid #a6192e;
		border-radius: 50%;
		opacity: 0;
		transition: opacity 0.12s ease;
		pointer-events: none;
	}

	.entity-root:hover :global(.entity-handle),
	.entity-root.active :global(.entity-handle) {
		opacity: 1;
		pointer-events: all;
	}

	/* NodeResizer corner anchors — matches the basic shapes' `.shape-resize-anchor`
	   (15px white square, red ring, soft shadow). The three-class selector
	   out-specifies xyflow's `.svelte-flow__resize-control.handle` (5px). */
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
