<script lang="ts">
	import { onMount } from 'svelte';
	import { useSvelteFlow } from '@xyflow/svelte';
	import type { NodePanelProps } from '../../types';
	import {
		ENTITY_FIELD_TYPES,
		FIELD_KEY_INFO,
		FIELD_KEY_ORDER,
		resolveFieldKey,
		type EntityData,
		type EntityField,
		type FieldKey
	} from './types';

	let { node, onDataChange }: NodePanelProps = $props();

	// Used to clear the wrapper's explicit height whenever the field count
	// changes — see commitFields for the why.
	const { updateNode } = useSvelteFlow();

	// Pull typed fields + the conceptual/physical toggle out of the generic
	// node.data bag. The cast is local so the rest of StylePanel stays
	// shape-agnostic.
	const entity = $derived((node.data ?? {}) as unknown as EntityData);
	const fields = $derived((entity.fields ?? []) as EntityField[]);
	const showDataTypes = $derived(entity.showDataTypes ?? false);

	// Only one dropdown (of either kind) can be open at a time; tracked by
	// index. The two never coexist on the same field — opening one closes
	// the other.
	let openKeyIndex: number | null = $state(null);
	let openTypeIndex: number | null = $state(null);
	let rootEl: HTMLDivElement | undefined = $state();

	onMount(() => {
		const onPointer = (event: PointerEvent) => {
			const target = event.target as Node | null;
			if (rootEl && target && !rootEl.contains(target)) {
				openKeyIndex = null;
				openTypeIndex = null;
			}
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				openKeyIndex = null;
				openTypeIndex = null;
			}
		};
		window.addEventListener('pointerdown', onPointer);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('pointerdown', onPointer);
			window.removeEventListener('keydown', onKey);
		};
	});

	function commitFields(next: EntityField[]) {
		onDataChange({ fields: next });

		// Field count drives the entity's intrinsic content height. If the
		// user previously drag-resized the card to a fixed height, that
		// height is now locked in inline style and would clip (or trail)
		// the new field. Strip the explicit `height` from the node so the
		// next render lets content drive the size again. Width is left
		// alone — the user's chosen card width survives field edits.
		updateNode(node.id, (n) => {
			const styleStr =
				typeof n.style === 'string'
					? n.style.replace(/height:\s*[^;]+;?\s*/g, '').trim()
					: n.style;
			return {
				height: undefined,
				style: styleStr || undefined
			};
		});
	}

	function patchField(index: number, patch: Partial<EntityField>) {
		commitFields(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
	}

	/**
	 * Sets a field's key. Also strips the legacy isPK / isFK booleans from
	 * the persisted shape so old data doesn't outlive the single-select
	 * model on the next save.
	 */
	function setFieldKey(index: number, key: FieldKey | undefined) {
		commitFields(
			fields.map((f, i) => {
				if (i !== index) return f;
				const next = { ...f } as EntityField & { isPK?: boolean; isFK?: boolean };
				if (key) next.key = key;
				else delete next.key;
				delete next.isPK;
				delete next.isFK;
				return next;
			})
		);
		openKeyIndex = null;
	}

	function removeField(index: number) {
		commitFields(fields.filter((_, i) => i !== index));
		if (openKeyIndex === index) openKeyIndex = null;
		if (openTypeIndex === index) openTypeIndex = null;
	}

	function addField() {
		commitFields([...fields, { name: 'field' }]);
	}

	function toggleKey(index: number) {
		openKeyIndex = openKeyIndex === index ? null : index;
		openTypeIndex = null;
	}

	function toggleType(index: number) {
		openTypeIndex = openTypeIndex === index ? null : index;
		openKeyIndex = null;
	}

	function selectType(index: number, value: string) {
		patchField(index, { type: value });
		openTypeIndex = null;
	}

	function setShowDataTypes(value: boolean) {
		onDataChange({ showDataTypes: value });
		// If the user just turned types off, close any open type dropdowns
		// so the panel doesn't have an orphan popup hanging around.
		if (!value) openTypeIndex = null;
	}
</script>

{#snippet keyBadge(key: FieldKey | undefined)}
	{#if key}
		<span class="key-badge" data-key={key}>{FIELD_KEY_INFO[key].short}</span>
	{:else}
		<!-- "None" state in the dropdown row uses an em-dash placeholder. -->
		<span class="key-badge key-badge-none">—</span>
	{/if}
{/snippet}

{#snippet chevron(up: boolean)}
	<svg
		viewBox="0 0 24 24"
		width="14"
		height="14"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="chevron"
		class:up
	>
		<polyline points="6 9 12 15 18 9" />
	</svg>
{/snippet}

<div class="field-editor" bind:this={rootEl}>
	<div class="editor-header">
		<h3 class="group-label">FIELDS</h3>
		<span class="count">{fields.length}</span>
	</div>

	{#each fields as field, i}
		{@const key = resolveFieldKey(field)}
		{@const keyOpen = openKeyIndex === i}
		{@const typeOpen = openTypeIndex === i}
		<div class="field-card" class:editing={keyOpen || typeOpen}>
			<div class="card-row">
				<!-- Key button: colored badge for set keys, key icon for None. -->
				<div class="key-button-wrap">
					<button
						type="button"
						class="key-button"
						class:open={keyOpen}
						data-key={key ?? 'NONE'}
						aria-haspopup="listbox"
						aria-expanded={keyOpen}
						aria-label={key ? FIELD_KEY_INFO[key].long : 'Set key'}
						onclick={() => toggleKey(i)}
					>
						{#if key}
							<span class="key-button-text">{FIELD_KEY_INFO[key].short}</span>
						{:else}
							<svg
								viewBox="0 0 24 24"
								width="14"
								height="14"
								fill="none"
								stroke="currentColor"
								stroke-width="1.7"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="key-icon"
							>
								<circle cx="9" cy="14" r="4" />
								<path d="M12 11l9 -9" />
								<path d="M18 5l2 2" />
								<path d="M16 7l2 2" />
							</svg>
						{/if}
						{@render chevron(keyOpen)}
					</button>

					{#if keyOpen}
						<ul class="key-dropdown" role="listbox">
							{#each FIELD_KEY_ORDER as option (option)}
								{@const info = FIELD_KEY_INFO[option]}
								{@const isSelected = key === option}
								<li>
									<button
										type="button"
										role="option"
										aria-selected={isSelected}
										class="key-option"
										class:selected={isSelected}
										data-key={option}
										onclick={() => setFieldKey(i, option)}
									>
										{@render keyBadge(option)}
										<span class="key-option-label">{info.long}</span>
										{#if isSelected}
											<svg
												viewBox="0 0 24 24"
												width="14"
												height="14"
												fill="none"
												stroke="currentColor"
												stroke-width="2.4"
												stroke-linecap="round"
												stroke-linejoin="round"
												class="check"
											>
												<polyline points="5 12 10 17 19 8" />
											</svg>
										{/if}
									</button>
								</li>
							{/each}
							<li class="dropdown-divider" role="separator"></li>
							<li>
								<button
									type="button"
									role="option"
									aria-selected={!key}
									class="key-option"
									class:selected={!key}
									onclick={() => setFieldKey(i, undefined)}
								>
									{@render keyBadge(undefined)}
									<span class="key-option-label muted">None</span>
								</button>
							</li>
						</ul>
					{/if}
				</div>

				<input
					type="text"
					class="name-input"
					value={field.name}
					placeholder="field"
					oninput={(e) => patchField(i, { name: e.currentTarget.value })}
					aria-label="Field name"
				/>

				<button
					type="button"
					class="delete-btn"
					aria-label="Remove field"
					onclick={() => removeField(i)}
				>
					<svg
						viewBox="0 0 24 24"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="3 6 5 6 21 6" />
						<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
						<path d="M10 11v6" />
						<path d="M14 11v6" />
						<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
					</svg>
				</button>
			</div>

			{#if showDataTypes}
				<div class="type-row">
					<button
						type="button"
						class="type-select"
						class:open={typeOpen}
						aria-haspopup="listbox"
						aria-expanded={typeOpen}
						onclick={() => toggleType(i)}
					>
						<span class="type-value">
							{field.type ? field.type.toUpperCase() : 'TYPE'}
						</span>
						{@render chevron(typeOpen)}
					</button>

					{#if typeOpen}
						<ul class="type-dropdown" role="listbox">
							{#each ENTITY_FIELD_TYPES as option (option)}
								{@const isSelected = field.type === option}
								<li>
									<button
										type="button"
										role="option"
										aria-selected={isSelected}
										class="type-option"
										class:selected={isSelected}
										onclick={() => selectType(i, option)}
									>
										<span>{option.toUpperCase()}</span>
										{#if isSelected}
											<svg
												viewBox="0 0 24 24"
												width="14"
												height="14"
												fill="none"
												stroke="currentColor"
												stroke-width="2.4"
												stroke-linecap="round"
												stroke-linejoin="round"
											>
												<polyline points="5 12 10 17 19 8" />
											</svg>
										{/if}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</div>
	{/each}

	<button type="button" class="add-field-btn" onclick={addField}>+ Add field</button>

	<!-- Master toggle: drives the type dropdowns here AND whether the entity
         node on the canvas shows each field's type. -->
	<div class="show-types-row">
		<span class="show-types-label">Show data types</span>
		<label class="toggle">
			<input
				type="checkbox"
				checked={showDataTypes}
				onchange={(e) => setShowDataTypes(e.currentTarget.checked)}
			/>
			<span class="toggle-slider"></span>
		</label>
	</div>
</div>

<style>
	.field-editor {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.group-label {
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		font-weight: 700;
		color: #76232f;
		margin: 0;
	}

	.count {
		font-size: 0.78rem;
		color: #8a8b83;
		font-variant-numeric: tabular-nums;
	}

	.field-card {
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 8px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		transition:
			border-color 0.12s ease,
			box-shadow 0.12s ease;
	}

	/* Mirror the picture: whichever field has an open dropdown gets a red
       outline so it's obvious which row is being edited. */
	.field-card.editing {
		border-color: #a6192e;
		box-shadow: 0 0 0 1px rgba(166, 25, 46, 0.25);
	}

	.card-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	/* ─── Key button + dropdown ──────────────────────────────────────── */

	.key-button-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.key-button {
		height: 30px;
		min-width: 52px;
		padding: 0 8px;
		border: 1px solid #d6d2c4;
		background: #ffffff;
		color: #8a8b83;
		border-radius: 6px;
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		transition:
			background 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease;
	}

	.key-button:hover {
		border-color: #c4c1b8;
	}

	/* Open state — only the chevron flips; border stays as-is so the
       overall card-border + open state combine cleanly. */
	.key-button.open {
		border-color: #a6192e;
	}

	/* Color the button by its currently selected key. */
	.key-button[data-key='PK'] {
		background: #fae9c8;
		color: #854f0b;
		border-color: #d8a85a;
	}
	.key-button[data-key='FK'] {
		background: #dce9fa;
		color: #1e4380;
		border-color: #7aa6e6;
	}
	.key-button[data-key='PI'] {
		background: #c8eae0;
		color: #0b6354;
		border-color: #5fb59f;
	}
	.key-button[data-key='WPI'] {
		background: #e3d8fa;
		color: #5a3fb0;
		border-color: #a18de0;
	}

	.key-button-text {
		line-height: 1;
	}

	.key-icon {
		opacity: 0.85;
	}

	.chevron {
		flex-shrink: 0;
		opacity: 0.7;
		transition: transform 0.15s ease;
	}

	.chevron.up {
		transform: rotate(180deg);
	}

	.key-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		list-style: none;
		margin: 0;
		padding: 4px;
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 8px;
		box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
		z-index: 200;
		min-width: 200px;
	}

	.key-dropdown li {
		list-style: none;
	}

	.key-option {
		width: 100%;
		background: transparent;
		border: none;
		padding: 8px 10px;
		font-family: inherit;
		font-size: 0.82rem;
		color: #373a36;
		text-align: left;
		cursor: pointer;
		border-radius: 4px;
		display: flex;
		align-items: center;
		gap: 10px;
		transition: background 0.1s ease;
	}

	.key-option:hover {
		background: #f5f3ef;
	}

	/* Tint the selected row with the key's own color so the dropdown
       reads like a row of stained pills. */
	.key-option[data-key='PK'].selected {
		background: #fff5e0;
	}
	.key-option[data-key='FK'].selected {
		background: #eaf2fd;
	}
	.key-option[data-key='PI'].selected {
		background: #d9f1e9;
	}
	.key-option[data-key='WPI'].selected {
		background: #ede4fc;
	}

	.key-option-label {
		flex: 1;
		font-weight: 500;
	}

	.key-option-label.muted {
		color: #8a8b83;
		font-weight: 400;
	}

	.check {
		color: #76232f;
		flex-shrink: 0;
	}

	.dropdown-divider {
		height: 1px;
		background: #e8e5de;
		margin: 4px 4px;
	}

	/* ─── Key badge (used inside dropdown rows) ──────────────────────── */

	.key-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 36px;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1.4;
		flex-shrink: 0;
	}

	.key-badge[data-key='PK'] {
		background: #fae9c8;
		color: #854f0b;
	}
	.key-badge[data-key='FK'] {
		background: #dce9fa;
		color: #1e4380;
	}
	.key-badge[data-key='PI'] {
		background: #c8eae0;
		color: #0b6354;
	}
	.key-badge[data-key='WPI'] {
		background: #e3d8fa;
		color: #5a3fb0;
	}

	.key-badge-none {
		background: transparent;
		color: #b8b8b8;
		font-weight: 400;
	}

	/* ─── Name input + delete ────────────────────────────────────────── */

	.name-input {
		flex: 1;
		min-width: 0;
		border: 1px solid #d6d2c4;
		border-radius: 6px;
		padding: 8px 10px;
		font-family: inherit;
		font-size: 0.9rem;
		outline: none;
		background: #ffffff;
		color: #373a36;
	}

	.name-input:focus {
		border-color: #a6192e;
	}

	.delete-btn {
		width: 32px;
		height: 32px;
		border: none;
		background: transparent;
		color: #8a8b83;
		cursor: pointer;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition:
			background 0.12s ease,
			color 0.12s ease;
	}

	.delete-btn:hover {
		background: #fdf2f1;
		color: #b42318;
	}

	/* ─── Type row (only when showDataTypes is on) ───────────────────── */

	.type-row {
		position: relative;
	}

	.type-select {
		width: 100%;
		height: 32px;
		padding: 0 10px;
		border: 1px solid #d6d2c4;
		background: #ffffff;
		color: #373a36;
		border-radius: 6px;
		font-family: inherit;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		transition: border-color 0.12s ease;
	}

	.type-select.open {
		border-color: #a6192e;
		color: #76232f;
	}

	.type-value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.type-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		list-style: none;
		margin: 0;
		padding: 4px;
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 8px;
		box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
		z-index: 200;
		max-height: 220px;
		overflow-y: auto;
	}

	.type-dropdown li {
		list-style: none;
	}

	.type-option {
		width: 100%;
		background: transparent;
		border: none;
		padding: 8px 10px;
		font-family: inherit;
		font-size: 0.78rem;
		font-weight: 600;
		color: #373a36;
		text-align: left;
		cursor: pointer;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		transition:
			background 0.1s ease,
			color 0.1s ease;
	}

	.type-option:hover {
		background: #fbeef0;
		color: #76232f;
	}

	.type-option.selected {
		color: #76232f;
	}

	/* ─── Add-field button + show-types toggle ───────────────────────── */

	.add-field-btn {
		width: 100%;
		padding: 10px;
		border: 1px dashed #c4c1b8;
		background: transparent;
		color: #8a8b83;
		border-radius: 8px;
		font-family: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		transition:
			border-color 0.12s ease,
			color 0.12s ease,
			background 0.12s ease;
	}

	.add-field-btn:hover {
		border-color: #76232f;
		color: #76232f;
		background: #fbeef0;
	}

	.show-types-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 4px;
	}

	.show-types-label {
		font-size: 0.85rem;
		color: #373a36;
	}

	.toggle {
		position: relative;
		width: 36px;
		height: 20px;
		display: inline-block;
		flex-shrink: 0;
	}

	.toggle input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: absolute;
		inset: 0;
		background: #d0cabd;
		border-radius: 999px;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.toggle-slider::before {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		background: #ffffff;
		border-radius: 50%;
		transition: transform 0.15s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
	}

	.toggle input:checked + .toggle-slider {
		background: #a6192e;
	}

	.toggle input:checked + .toggle-slider::before {
		transform: translateX(16px);
	}
</style>
