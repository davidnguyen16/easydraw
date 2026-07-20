<script lang="ts">
	import ColorField from '$lib/components/ColorField.svelte';
	import type { NodeStyleData } from '$lib/components/style-panel/StylePanel.svelte';
	import {
		GROUP,
		GROUP_LABEL,
		ROW,
		ROW_LABEL,
		STEPPER,
		STEPPER_BTN,
		SIZE_INPUT,
		SWATCH,
		TOGGLE,
		TOGGLE_SLIDER
	} from './ui';

	interface Props {
		style: NodeStyleData;
		onStyleChange: (patch: Partial<NodeStyleData>) => void;
	}

	let { style, onStyleChange }: Props = $props();

	// White leads: it's the default fill of every shape (and the entity
	// header), so the row starts on the swatch that's actually active.
	const FILL_COLORS = ['#FFFFFF', '#76232F', '#A6192E', '#6B4DBA', '#0E7E63', '#9C6B1A'];

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
	<div class="grid grid-cols-6 gap-1.5">
		{#each FILL_COLORS as color}
			<button
				type="button"
				class={SWATCH}
				class:active={fillColor.toUpperCase() === color}
				class:is-white={color === '#FFFFFF'}
				style="background-color: {color}"
				aria-label="Fill {color}"
				onclick={() => onStyleChange({ fillColor: color })}
			></button>
		{/each}
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
