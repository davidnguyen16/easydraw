<script lang="ts">
	import ColorField from '$lib/components/ColorField.svelte';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import type { NodeStyleData } from '$lib/components/style-panel/StylePanel.svelte';
	import {
		GROUP,
		GROUP_LABEL,
		ROW,
		ROW_LABEL,
		STEPPER,
		STEPPER_BTN,
		SIZE_INPUT,
		TOGGLE,
		TOGGLE_SLIDER
	} from './ui';

	interface Props {
		style: NodeStyleData;
		onStyleChange: (patch: Partial<NodeStyleData>) => void;
	}

	let { style, onStyleChange }: Props = $props();

	// FILL palette pages (draw.io-style ◀ ▶ pager). Page 0 is the brand default
	// set the panel opens on — white leads because it's the actual default fill of
	// every shape (and the entity header) — so the row starts on the swatch that's
	// really active. The rest are ~24 classic colours, six per page to keep the
	// single-row layout. Reordering/adding here just changes what the arrows page
	// through; keep six per page so every page fills the row.
	const FILL_SWATCH_PAGES: string[][] = [
		['#FFFFFF', '#76232F', '#A6192E', '#6B4DBA', '#0E7E63', '#9C6B1A'], // defaults
		['#E53935', '#FF6347', '#FF7F0E', '#FB8C00', '#FFC107', '#FFD700'], // reds & oranges
		['#FFEB3B', '#CDDC39', '#8BC34A', '#4CAF50', '#2E7D32', '#009688'], // yellows & greens
		['#00BCD4', '#4FC3F7', '#2196F3', '#1F77B4', '#1A237E', '#3F51B5'], // cyans & blues
		['#673AB7', '#9C27B0', '#E91E63', '#795548', '#9E9E9E', '#2C2C2A'] // purples, pink & neutrals
	];
	const LAST_FILL_PAGE = FILL_SWATCH_PAGES.length - 1;

	// Which palette page is showing. Component-local $state, so it resets to 0
	// every time this tab (re)mounts — toggling the style panel off/on unmounts
	// it (see Flow's `{#if showStylePanel}`) — meaning reopening always lands back
	// on the default page, per spec.
	let fillPage = $state(0);
	const fillColors = $derived(FILL_SWATCH_PAGES[fillPage]);

	// Arrow buttons flanking the swatch row. No fixed height — the row is
	// items-stretch, so each arrow grows to exactly the swatch height and stays
	// aligned with the squares. Disabled (dimmed) at the ends.
	const FILL_ARROW = [
		'flex w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded border-none',
		'bg-transparent text-ink-muted transition-colors duration-[120ms]',
		'hover:bg-surface-hover hover:text-mq-maroon',
		'disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted'
	].join(' ');

	// Fill swatches: square (aspect-square), width auto-fills the grid cell so all
	// six sit in one row with the arrows. The 6-col grid + gap set the size; gap-1
	// below shows a real gap between them.
	const FILL_SWATCH = [
		'aspect-square w-full cursor-pointer rounded border border-transparent p-0',
		'transition-[transform,box-shadow] duration-100 hover:-translate-y-px',
		'[&.is-white]:border-line [&.active]:shadow-[0_0_0_2px_#76232f]'
	].join(' ');

	// Matches the real rendered default: ShapeNode falls back to white, so the
	// panel opens showing the truth.
	let fillColor = $derived(style.fillColor ?? '#FFFFFF');
	let borderColor = $derived(style.borderColor ?? '#2C2C2A');
	let borderWidth = $derived(style.borderWidth ?? 1);
	let shadow = $derived(style.shadow ?? false);
	let opacity = $derived(Math.max(0, Math.min(100, style.opacity ?? 100)));

	const BORDER_WIDTH_MAX = 10;

	function adjustBorderWidth(delta: number) {
		const next = Math.max(0, Math.min(BORDER_WIDTH_MAX, borderWidth + delta));
		onStyleChange({ borderWidth: next });
	}

	// Editable border-width field: show the live value until focused, then a
	// local draft string so typing isn't clobbered by reactive updates.
	// Enter / blur commits (clamped); Escape cancels.
	let borderWidthDraft = $state<string | null>(null);

	function commitBorderWidth() {
		if (borderWidthDraft !== null) {
			const n = parseFloat(borderWidthDraft);
			if (!Number.isNaN(n)) {
				onStyleChange({ borderWidth: Math.max(0, Math.min(BORDER_WIDTH_MAX, n)) });
			}
		}
		borderWidthDraft = null;
	}

	function onBorderWidthKeydown(event: KeyboardEvent) {
		const input = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			commitBorderWidth();
			input.blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			borderWidthDraft = null;
			input.blur();
		}
	}

	const OPACITY_MIN = 0;
	const OPACITY_MAX = 100;

	function clampOpacity(value: number) {
		return Math.max(OPACITY_MIN, Math.min(OPACITY_MAX, value));
	}

	let opacityDraft = $state<string | null>(null);

	function commitOpacity() {
		if (opacityDraft !== null) {
			const n = parseFloat(opacityDraft);
			if (!Number.isNaN(n)) {
				onStyleChange({ opacity: clampOpacity(n) });
			}
		}
		opacityDraft = null;
	}

	function onOpacityKeydown(event: KeyboardEvent) {
		const input = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			commitOpacity();
			input.blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			opacityDraft = null;
			input.blur();
		}
	}
</script>

<section class={GROUP}>
	<h3 class={GROUP_LABEL}>FILL</h3>
	<div class="flex items-stretch gap-1">
		<button
			type="button"
			class={FILL_ARROW}
			aria-label="Previous colours"
			disabled={fillPage === 0}
			onclick={() => (fillPage = Math.max(0, fillPage - 1))}
		>
			<ChevronLeft size={18} />
		</button>
		<div class="grid flex-1 grid-cols-6 gap-1">
			{#each fillColors as color}
				<button
					type="button"
					class={FILL_SWATCH}
					class:active={fillColor.toUpperCase() === color}
					class:is-white={color === '#FFFFFF'}
					style="background-color: {color}"
					aria-label="Fill {color}"
					onclick={() => onStyleChange({ fillColor: color })}
				></button>
			{/each}
		</div>
		<button
			type="button"
			class={FILL_ARROW}
			aria-label="More colours"
			disabled={fillPage === LAST_FILL_PAGE}
			onclick={() => (fillPage = Math.min(LAST_FILL_PAGE, fillPage + 1))}
		>
			<ChevronRight size={18} />
		</button>
	</div>
	<div class={ROW}>
		<span class={ROW_LABEL}>Custom</span>
		<ColorField
			value={fillColor}
			label="Fill"
			onChange={(hex) => onStyleChange({ fillColor: hex })}
		/>
	</div>
</section>

<section class={GROUP}>
	<h3 class={GROUP_LABEL}>BORDER</h3>
	<div class={ROW}>
		<span class={ROW_LABEL}>Color</span>
		<ColorField
			value={borderColor}
			label="Border"
			onChange={(hex) => onStyleChange({ borderColor: hex })}
		/>
	</div>
	<div class={ROW}>
		<span class={ROW_LABEL}>Width</span>
		<div class={STEPPER}>
			<button
				type="button"
				class={STEPPER_BTN}
				aria-label="Decrease width"
				onclick={() => adjustBorderWidth(-1)}>−</button
			>
			<input
				class={SIZE_INPUT}
				type="text"
				inputmode="decimal"
				aria-label="Border width"
				value={borderWidthDraft ?? `${borderWidth}`}
				oninput={(e) => (borderWidthDraft = e.currentTarget.value)}
				onfocus={(e) => {
					borderWidthDraft = `${borderWidth}`;
					e.currentTarget.select();
				}}
				onblur={commitBorderWidth}
				onkeydown={onBorderWidthKeydown}
			/>
			<button
				type="button"
				class={STEPPER_BTN}
				aria-label="Increase width"
				onclick={() => adjustBorderWidth(1)}>+</button
			>
		</div>
	</div>
</section>

<section class={GROUP}>
	<h3 class={GROUP_LABEL}>EFFECTS</h3>
	<div class="flex flex-col gap-2">
		<div class={ROW}>
			<span class={ROW_LABEL}>Opacity</span>
			<label
				class="inline-flex h-[30px] min-w-[58px] items-center rounded-md border border-line
					bg-white px-2 text-[0.78rem] font-medium tabular-nums text-ink-soft
					focus-within:border-mq-red"
			>
				<input
					class="w-8 min-w-0 border-none bg-transparent p-0 text-right text-[0.78rem]
						font-medium tabular-nums text-ink-soft outline-none [appearance:textfield]
						[&::-webkit-inner-spin-button]:appearance-none
						[&::-webkit-outer-spin-button]:appearance-none"
					type="text"
					inputmode="decimal"
					aria-label="Opacity percentage"
					value={opacityDraft ?? `${opacity}`}
					oninput={(e) => (opacityDraft = e.currentTarget.value)}
					onfocus={(e) => {
						opacityDraft = `${opacity}`;
						e.currentTarget.select();
					}}
					onblur={commitOpacity}
					onkeydown={onOpacityKeydown}
				/>
				<span class="pl-0.5 text-ink-muted">%</span>
			</label>
		</div>
		<input
			type="range"
			min="0"
			max="100"
			step="1"
			value={opacity}
			aria-label="Opacity"
			aria-valuetext={`${opacity}%`}
			class="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#e8e5de]
				accent-mq-red outline-none
				[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4
				[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2
				[&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-mq-red
				[&::-moz-range-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.25)]
				[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
				[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
				[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
				[&::-webkit-slider-thumb]:bg-mq-red
				[&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
			style={`background: linear-gradient(to right, #a6192e 0%, #a6192e ${opacity}%, #e8e5de ${opacity}%, #e8e5de 100%);`}
			oninput={(e) => {
				opacityDraft = null;
				onStyleChange({ opacity: e.currentTarget.valueAsNumber });
			}}
		/>
	</div>
	<div class={ROW}>
		<span class={ROW_LABEL}>Shadow</span>
		<label class={TOGGLE}>
			<input
				class="peer h-0 w-0 opacity-0"
				type="checkbox"
				checked={shadow}
				onchange={(e) => onStyleChange({ shadow: e.currentTarget.checked })}
			/>
			<span class={TOGGLE_SLIDER}></span>
		</label>
	</div>
</section>
