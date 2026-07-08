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

	// Per-key palettes, keyed lookups replacing the old `[data-key='…']`
	// attribute selectors. Button = filled pill (bg+text+border); badge = the
	// same minus border; option-selected = a faint tint of the same hue.
	const KEY_BUTTON_CLASS: Record<FieldKey, string> = {
		PK: 'bg-[#fae9c8] text-[#854f0b] border-[#d8a85a]',
		FK: 'bg-[#dce9fa] text-[#1e4380] border-[#7aa6e6]',
		PI: 'bg-[#c8eae0] text-[#0b6354] border-[#5fb59f]',
		WPI: 'bg-[#e3d8fa] text-[#5a3fb0] border-[#a18de0]'
	};
	const KEY_BADGE_CLASS: Record<FieldKey, string> = {
		PK: 'bg-[#fae9c8] text-[#854f0b]',
		FK: 'bg-[#dce9fa] text-[#1e4380]',
		PI: 'bg-[#c8eae0] text-[#0b6354]',
		WPI: 'bg-[#e3d8fa] text-[#5a3fb0]'
	};
	const KEY_OPTION_SELECTED_BG: Record<FieldKey, string> = {
		PK: 'bg-[#fff5e0]',
		FK: 'bg-[#eaf2fd]',
		PI: 'bg-[#d9f1e9]',
		WPI: 'bg-[#ede4fc]'
	};
</script>

{#snippet keyBadge(key: FieldKey | undefined)}
	{#if key}
		<span
			class="{KEY_BADGE_CLASS[key]} inline-flex min-w-[36px] flex-shrink-0 items-center
				justify-center rounded px-1.5 py-0.5 text-[0.72rem] leading-[1.4] font-bold"
			>{FIELD_KEY_INFO[key].short}</span
		>
	{:else}
		<!-- "None" state in the dropdown row uses an em-dash placeholder. -->
		<span
			class="inline-flex min-w-[36px] flex-shrink-0 items-center justify-center rounded bg-transparent
				px-1.5 py-0.5 text-[0.72rem] leading-[1.4] font-normal text-[#b8b8b8]">—</span
		>
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
		class="flex-shrink-0 opacity-70 transition-transform duration-150 {up ? 'rotate-180' : ''}"
	>
		<polyline points="6 9 12 15 18 9" />
	</svg>
{/snippet}

<div class="flex flex-col gap-2.5" bind:this={rootEl}>
	<div class="flex items-center justify-between">
		<h3 class="m-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">FIELDS</h3>
		<span class="text-[0.78rem] tabular-nums text-ink-muted">{fields.length}</span>
	</div>

	{#each fields as field, i}
		{@const key = resolveFieldKey(field)}
		{@const keyOpen = openKeyIndex === i}
		{@const typeOpen = openTypeIndex === i}
		<div
			class="flex flex-col gap-2 rounded-lg border bg-white p-2.5 transition-[border-color,box-shadow]
				duration-[120ms] {keyOpen || typeOpen
				? 'border-mq-red shadow-[0_0_0_1px_rgba(166,25,46,0.25)]'
				: 'border-line'}"
		>
			<div class="flex items-center gap-1.5">
				<!-- Key button: colored badge for set keys, key icon for None. -->
				<div class="relative flex-shrink-0">
					<button
						type="button"
						class="inline-flex h-[30px] min-w-[52px] cursor-pointer items-center gap-1 rounded-md
							border px-2 text-[0.75rem] font-bold transition-colors duration-[120ms] {key
							? KEY_BUTTON_CLASS[key]
							: keyOpen
								? 'border-mq-red bg-white text-ink-muted'
								: 'border-line bg-white text-ink-muted hover:border-[#c4c1b8]'}"
						aria-haspopup="listbox"
						aria-expanded={keyOpen}
						aria-label={key ? FIELD_KEY_INFO[key].long : 'Set key'}
						onclick={() => toggleKey(i)}
					>
						{#if key}
							<span class="leading-none">{FIELD_KEY_INFO[key].short}</span>
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
								class="opacity-[0.85]"
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
						<ul
							class="absolute top-[calc(100%+4px)] left-0 z-[200] m-0 min-w-[200px] list-none
								rounded-lg border border-line bg-white p-1 shadow-[0_12px_24px_rgba(0,0,0,0.12)]"
							role="listbox"
						>
							{#each FIELD_KEY_ORDER as option (option)}
								{@const info = FIELD_KEY_INFO[option]}
								{@const isSelected = key === option}
								<li>
									<button
										type="button"
										role="option"
										aria-selected={isSelected}
										class="flex w-full cursor-pointer items-center gap-2.5 rounded border-none
											bg-transparent px-2.5 py-2 text-left text-[0.82rem] text-ink-soft
											transition-colors duration-100 {isSelected
											? KEY_OPTION_SELECTED_BG[option]
											: 'hover:bg-panel'}"
										onclick={() => setFieldKey(i, option)}
									>
										{@render keyBadge(option)}
										<span class="flex-1 font-medium">{info.long}</span>
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
												class="flex-shrink-0 text-mq-maroon"
											>
												<polyline points="5 12 10 17 19 8" />
											</svg>
										{/if}
									</button>
								</li>
							{/each}
							<li class="mx-1 my-1 h-px list-none bg-[#e8e5de]" role="separator"></li>
							<li>
								<button
									type="button"
									role="option"
									aria-selected={!key}
									class="flex w-full cursor-pointer items-center gap-2.5 rounded border-none
										bg-transparent px-2.5 py-2 text-left text-[0.82rem] text-ink-soft
										transition-colors duration-100 hover:bg-panel"
									onclick={() => setFieldKey(i, undefined)}
								>
									{@render keyBadge(undefined)}
									<span class="flex-1 font-normal text-ink-muted">None</span>
								</button>
							</li>
						</ul>
					{/if}
				</div>

				<input
					type="text"
					class="min-w-0 flex-1 rounded-md border border-line bg-white px-2.5 py-2 text-[0.9rem]
						text-ink-soft outline-none focus:border-mq-red"
					value={field.name}
					placeholder="field"
					oninput={(e) => patchField(i, { name: e.currentTarget.value })}
					aria-label="Field name"
				/>

				<button
					type="button"
					class="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-md
						border-none bg-transparent text-ink-muted transition-colors duration-[120ms]
						hover:bg-[#fdf2f1] hover:text-[#b42318]"
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
				<div class="relative">
					<button
						type="button"
						class="flex h-8 w-full cursor-pointer items-center justify-between gap-1.5 rounded-md
							border bg-white px-2.5 text-[0.78rem] font-semibold transition-colors duration-[120ms]
							{typeOpen ? 'border-mq-red text-mq-maroon' : 'border-line text-ink-soft'}"
						aria-haspopup="listbox"
						aria-expanded={typeOpen}
						onclick={() => toggleType(i)}
					>
						<span class="overflow-hidden text-ellipsis whitespace-nowrap">
							{field.type ? field.type.toUpperCase() : 'TYPE'}
						</span>
						{@render chevron(typeOpen)}
					</button>

					{#if typeOpen}
						<ul
							class="absolute top-[calc(100%+4px)] right-0 left-0 z-[200] m-0 max-h-[220px] list-none
								overflow-y-auto rounded-lg border border-line bg-white p-1
								shadow-[0_12px_24px_rgba(0,0,0,0.12)]"
							role="listbox"
						>
							{#each ENTITY_FIELD_TYPES as option (option)}
								{@const isSelected = field.type === option}
								<li>
									<button
										type="button"
										role="option"
										aria-selected={isSelected}
										class="flex w-full cursor-pointer items-center justify-between gap-1.5 rounded
											border-none bg-transparent px-2.5 py-2 text-left text-[0.78rem] font-semibold
											transition-colors duration-100 hover:bg-mq-pink hover:text-mq-maroon
											{isSelected ? 'text-mq-maroon' : 'text-ink-soft'}"
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

	<button
		type="button"
		class="w-full cursor-pointer rounded-lg border border-dashed border-[#c4c1b8] bg-transparent p-2.5
			text-[0.85rem] text-ink-muted transition-colors duration-[120ms] hover:border-mq-maroon
			hover:bg-mq-pink hover:text-mq-maroon"
		onclick={addField}>+ Add field</button
	>

	<!-- Master toggle: drives the type dropdowns here AND whether the entity
         node on the canvas shows each field's type. -->
	<div class="flex items-center justify-between pt-1">
		<span class="text-[0.85rem] text-ink-soft">Show data types</span>
		<label class="relative inline-block h-5 w-9 flex-shrink-0">
			<input
				class="peer h-0 w-0 opacity-0"
				type="checkbox"
				checked={showDataTypes}
				onchange={(e) => setShowDataTypes(e.currentTarget.checked)}
			/>
			<span
				class="absolute inset-0 cursor-pointer rounded-full bg-[#d0cabd] transition-colors
					duration-150 before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4
					before:rounded-full before:bg-white before:shadow-[0_1px_2px_rgba(0,0,0,0.15)]
					before:transition-transform before:duration-150 before:content-['']
					peer-checked:bg-mq-red peer-checked:before:translate-x-4"
			></span>
		</label>
	</div>
</div>
