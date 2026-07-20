<script lang="ts">
	import ColorField from '$lib/components/ColorField.svelte';
	import type { NodeStyleData, TextAlign } from '$lib/components/style-panel/StylePanel.svelte';
	import { FONT_FAMILIES, DEFAULT_FONT_FAMILY } from '$lib/fonts';
	import {
		GROUP,
		GROUP_LABEL,
		ROW,
		ROW_LABEL,
		STEPPER,
		STEPPER_BTN,
		SIZE_INPUT,
		SQUARE_BTN,
		SWATCH
	} from './ui';

	interface Props {
		style: NodeStyleData;
		onStyleChange: (patch: Partial<NodeStyleData>) => void;
	}

	let { style, onStyleChange }: Props = $props();

	const TEXT_COLORS = ['#2C2C2A', '#FFFFFF', '#A6192E', '#6B4DBA', '#0E7E63', '#9C6B1A'];
	const TEXT_ALIGNMENTS: TextAlign[] = ['left', 'center', 'right'];

	let textColor = $derived(style.textColor ?? '#2C2C2A');
	let fontFamily = $derived(style.fontFamily ?? DEFAULT_FONT_FAMILY);
	let fontSize = $derived(style.fontSize ?? 14);
	let bold = $derived(style.bold ?? false);
	let italic = $derived(style.italic ?? false);
	let underline = $derived(style.underline ?? false);
	let textAlign: TextAlign = $derived(style.textAlign ?? 'center');

	const FONT_SIZE_MIN = 8;
	const FONT_SIZE_MAX = 96;

	function adjustFontSize(delta: number) {
		const next = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, fontSize + delta));
		onStyleChange({ fontSize: next });
	}

	// Editable size field: show the live value until focused, then a local draft
	// string so typing isn't clobbered by reactive updates. Enter / blur commits
	// (clamped); Escape cancels.
	let sizeDraft = $state<string | null>(null);

	function commitFontSize() {
		if (sizeDraft !== null) {
			const n = parseInt(sizeDraft, 10);
			if (!Number.isNaN(n)) {
				onStyleChange({ fontSize: Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, n)) });
			}
		}
		sizeDraft = null;
	}

	function onSizeKeydown(event: KeyboardEvent) {
		const input = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			commitFontSize();
			input.blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			sizeDraft = null;
			input.blur();
		}
	}

	// ─── Font family dropdown (custom menu with live typeface preview) ──
	// Not a native <select>: Chromium on Windows paints the option popup with
	// the OS control, IGNORING per-option font-family — the typeface preview
	// only renders in a DOM menu we own. The menu escapes the panel's
	// overflow:hidden via position:fixed, with coordinates computed from the
	// trigger button when it opens.
	let fontMenuOpen = $state(false);
	let fontTriggerEl = $state<HTMLButtonElement>();
	let fontMenuEl = $state<HTMLDivElement>();
	let fontMenuStyle = $state('');

	const FONT_MENU_MAX_H = 280;

	function toggleFontMenu() {
		if (fontMenuOpen) {
			fontMenuOpen = false;
			return;
		}
		const rect = fontTriggerEl?.getBoundingClientRect();
		if (!rect) return;
		// Drop below the trigger; flip above when the space below is too tight.
		const openUp = window.innerHeight - rect.bottom < FONT_MENU_MAX_H + 12;
		fontMenuStyle = [
			`left: ${rect.left}px`,
			`width: ${rect.width}px`,
			openUp ? `bottom: ${window.innerHeight - rect.top + 4}px` : `top: ${rect.bottom + 4}px`,
			`max-height: ${FONT_MENU_MAX_H}px`
		].join('; ');
		fontMenuOpen = true;
	}

	function pickFont(family: string) {
		onStyleChange({ fontFamily: family });
		fontMenuOpen = false;
	}

	// While open: close on outside click, Escape, or any scroll outside the
	// menu (a fixed-position menu would otherwise detach from its trigger
	// when the panel content scrolls under it).
	$effect(() => {
		if (!fontMenuOpen) return;
		const onPointerDown = (e: PointerEvent) => {
			if (e.target instanceof Node) {
				if (fontTriggerEl?.contains(e.target) || fontMenuEl?.contains(e.target)) return;
			}
			fontMenuOpen = false;
		};
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') fontMenuOpen = false;
		};
		const onScroll = (e: Event) => {
			if (fontMenuEl && e.target instanceof Node && fontMenuEl.contains(e.target)) return;
			fontMenuOpen = false;
		};
		window.addEventListener('pointerdown', onPointerDown, true);
		window.addEventListener('keydown', onKeydown, true);
		window.addEventListener('scroll', onScroll, true);
		return () => {
			window.removeEventListener('pointerdown', onPointerDown, true);
			window.removeEventListener('keydown', onKeydown, true);
			window.removeEventListener('scroll', onScroll, true);
		};
	});
</script>

<section class={GROUP}>
	<h3 class={GROUP_LABEL}>COLOR</h3>
	<div class="grid grid-cols-6 gap-1.5">
		{#each TEXT_COLORS as color}
			<button
				type="button"
				class={SWATCH}
				class:active={textColor.toUpperCase() === color}
				class:is-white={color === '#FFFFFF'}
				style="background-color: {color}"
				aria-label="Text color {color}"
				onclick={() => onStyleChange({ textColor: color })}
			></button>
		{/each}
	</div>
	<div class={ROW}>
		<span class={ROW_LABEL}>Custom</span>
		<ColorField
			value={textColor}
			label="Text"
			onChange={(hex) => onStyleChange({ textColor: hex })}
		/>
	</div>
</section>

<section class={GROUP}>
	<h3 class={GROUP_LABEL}>FONT</h3>
	<div class="relative">
		<button
			type="button"
			class="w-full cursor-pointer appearance-none overflow-hidden rounded-md border
				border-line bg-white py-[9px] pr-[30px] pl-2.5 text-left text-[0.9rem] leading-[1.2]
				text-ellipsis whitespace-nowrap text-ink-soft hover:border-[#c4c1b8]
				focus:border-mq-red focus:outline-none"
			bind:this={fontTriggerEl}
			style="font-family: {fontFamily};"
			aria-haspopup="listbox"
			aria-expanded={fontMenuOpen}
			aria-label="Font family"
			onclick={toggleFontMenu}
		>
			{fontFamily}
		</button>
		<span
			class="pointer-events-none absolute top-1/2 right-2.5 inline-flex -translate-y-1/2
				text-ink-muted"
			aria-hidden="true"
		>
			<svg
				viewBox="0 0 24 24"
				width="12"
				height="12"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</span>
		{#if fontMenuOpen}
			<div
				class="fixed z-[120] flex flex-col gap-0.5 overflow-y-auto rounded-lg border border-line
					bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
				role="listbox"
				aria-label="Font families"
				bind:this={fontMenuEl}
				style={fontMenuStyle}
			>
				{#each FONT_FAMILIES as family (family)}
					<button
						type="button"
						role="option"
						aria-selected={family === fontFamily}
						class="flex cursor-pointer items-center gap-1.5 rounded-md border-none bg-transparent
							px-2.5 py-[7px] text-left text-[0.9rem] whitespace-nowrap text-ink-soft
							hover:bg-[#f3f1ea]"
						onclick={() => pickFont(family)}
					>
						<span class="inline-flex w-3.5 flex-shrink-0 text-mq-red">
							{#if family === fontFamily}
								<svg
									viewBox="0 0 24 24"
									width="12"
									height="12"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="20 6 9 17 4 12" />
								</svg>
							{/if}
						</span>
						<span style="font-family: {family};">{family}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
	<div class={ROW}>
		<span class={ROW_LABEL}>Size</span>
		<div class={STEPPER}>
			<button
				type="button"
				class={STEPPER_BTN}
				aria-label="Decrease font size"
				onclick={() => adjustFontSize(-1)}>−</button
			>
			<input
				class={SIZE_INPUT}
				type="text"
				inputmode="numeric"
				aria-label="Font size"
				value={sizeDraft ?? `${fontSize}`}
				oninput={(e) => (sizeDraft = e.currentTarget.value)}
				onfocus={(e) => {
					sizeDraft = `${fontSize}`;
					e.currentTarget.select();
				}}
				onblur={commitFontSize}
				onkeydown={onSizeKeydown}
			/>
			<button
				type="button"
				class={STEPPER_BTN}
				aria-label="Increase font size"
				onclick={() => adjustFontSize(1)}>+</button
			>
		</div>
	</div>
</section>

<section class={GROUP}>
	<h3 class={GROUP_LABEL}>STYLE</h3>
	<div class="grid grid-cols-3 gap-1.5">
		<button
			type="button"
			class={SQUARE_BTN}
			class:active={bold}
			aria-label="Bold"
			aria-pressed={bold}
			onclick={() => onStyleChange({ bold: !bold })}
		>
			<span style="font-weight: 700">B</span>
		</button>
		<button
			type="button"
			class={SQUARE_BTN}
			class:active={italic}
			aria-label="Italic"
			aria-pressed={italic}
			onclick={() => onStyleChange({ italic: !italic })}
		>
			<span style="font-style: italic">I</span>
		</button>
		<button
			type="button"
			class={SQUARE_BTN}
			class:active={underline}
			aria-label="Underline"
			aria-pressed={underline}
			onclick={() => onStyleChange({ underline: !underline })}
		>
			<span style="text-decoration: underline">U</span>
		</button>
	</div>
</section>

<section class={GROUP}>
	<h3 class={GROUP_LABEL}>ALIGNMENT</h3>
	<div class="grid grid-cols-3 gap-1.5">
		{#each TEXT_ALIGNMENTS as align}
			<button
				type="button"
				class={SQUARE_BTN}
				class:active={textAlign === align}
				aria-label="Align {align}"
				aria-pressed={textAlign === align}
				onclick={() => onStyleChange({ textAlign: align })}
			>
				<svg
					viewBox="0 0 24 24"
					width="20"
					height="20"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				>
					{#if align === 'left'}
						<line x1="4" y1="7" x2="20" y2="7" />
						<line x1="4" y1="12" x2="14" y2="12" />
						<line x1="4" y1="17" x2="18" y2="17" />
					{:else if align === 'center'}
						<line x1="4" y1="7" x2="20" y2="7" />
						<line x1="7" y1="12" x2="17" y2="12" />
						<line x1="5" y1="17" x2="19" y2="17" />
					{:else}
						<line x1="4" y1="7" x2="20" y2="7" />
						<line x1="10" y1="12" x2="20" y2="12" />
						<line x1="6" y1="17" x2="20" y2="17" />
					{/if}
				</svg>
			</button>
		{/each}
	</div>
</section>
