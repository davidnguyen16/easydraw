<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import UiIcon from '$lib/components/icons/UiIcon.svelte';
	import { FolderOpen, Save } from '@lucide/svelte';
	import { FONT_FAMILIES } from '$lib/fonts';
	import type { NodeStyleData } from '$lib/components/style-panel/StylePanel.svelte';

	interface NodeTextStyle {
		fontFamily: string;
		fontSize: number;
		bold: boolean;
		italic: boolean;
		underline: boolean;
		textColor: string;
	}

	interface EditorContext {
		state: { zoomPercent: number; locked: boolean; showStylePanel: boolean };
		history: { canUndo: boolean; canRedo: boolean };
		save: () => void;
		open: () => void;
		newFile: () => void;
		undo: () => void;
		redo: () => void;
		zoomIn: () => void;
		zoomOut: () => void;
		fitView: () => void;
		fitSelection: () => void;
		setZoom: (percent: number) => void;
		toggleLock: () => void;
		toggleStylePanel: () => void;
		copy: () => void;
		duplicate: () => void;
		deleteSelected: () => void;
		// Text formatting of the selected node (null when nothing is selected).
		nodeStyle: NodeTextStyle | null;
		applyStyle: (patch: NodeStyleData) => void;
		// Live hover-preview of the font / size dropdowns on the selected node.
		// previewStyle paints without committing; endPreview reverts. A click
		// still commits through applyStyle.
		previewStyle: (patch: { fontFamily?: string; fontSize?: number }) => void;
		endPreview: () => void;
	}

	const editor = getContext<EditorContext>('editor');

	const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200];
	const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 24, 36, 48, 64];

	// Single open-dropdown tracker for the three menus (zoom / font / size).
	let openDropdown = $state<'zoom' | 'font' | 'size' | null>(null);
	const toggle = (name: 'zoom' | 'font' | 'size') =>
		(openDropdown = openDropdown === name ? null : name);
	const closeDropdowns = () => (openDropdown = null);

	// While a font / size dropdown is open, hovering an option previews it on the
	// selected node; the moment neither is open (pick, outside-click, Escape),
	// drop the preview so the label snaps back to its committed value.
	$effect(() => {
		if (openDropdown !== 'font' && openDropdown !== 'size') editor.endPreview();
	});

	// Current text style (falls back to sensible defaults when no selection so
	// the controls still read cleanly).
	const style = $derived(
		editor.nodeStyle ?? {
			fontFamily: 'Inter',
			fontSize: 14,
			bold: false,
			italic: false,
			underline: false,
			textColor: '#2c2c2a'
		}
	);

	function pickZoom(percent: number) {
		editor.setZoom(percent);
		closeDropdowns();
	}
	function pickFitView() {
		editor.fitView();
		closeDropdowns();
	}
	function pickFitSelection() {
		editor.fitSelection();
		closeDropdowns();
	}
	function pickFont(family: string) {
		editor.applyStyle({ fontFamily: family });
		closeDropdowns();
	}
	function pickSize(size: number) {
		editor.applyStyle({ fontSize: size });
		closeDropdowns();
	}

	// ─── Text colour ────────────────────────────────────────────────────
	// Live mirror of the colour picker so the swatch (the line under "A")
	// reflects the chosen colour the instant it changes — even mid-drag and
	// even with nothing selected. Falls back to the selected element's colour
	// when not actively picking; reset on `change` so it follows selection again.
	let liveTextColor = $state<string | null>(null);
	const swatchColor = $derived(liveTextColor ?? style.textColor);

	function onTextColorInput(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		liveTextColor = value;
		editor.applyStyle({ textColor: value });
	}

	// ─── Editable zoom % / font size ────────────────────────────────────
	// Each field shows the live value until the user focuses it; from then on
	// it shows a local draft string so typing isn't clobbered by reactive
	// updates. Enter / blur commits (clamped); Escape cancels. `null` draft =
	// not editing → display the live value.
	let zoomDraft = $state<string | null>(null);
	let sizeDraft = $state<string | null>(null);

	const ZOOM_MIN = 10;
	const ZOOM_MAX = 400;
	const SIZE_MIN = 1;
	const SIZE_MAX = 96;

	const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

	function commitZoom() {
		if (zoomDraft !== null) {
			const n = parseInt(zoomDraft, 10);
			if (!Number.isNaN(n)) editor.setZoom(clamp(n, ZOOM_MIN, ZOOM_MAX));
		}
		zoomDraft = null;
	}

	function commitSize() {
		if (sizeDraft !== null) {
			const n = parseInt(sizeDraft, 10);
			if (!Number.isNaN(n)) editor.applyStyle({ fontSize: clamp(n, SIZE_MIN, SIZE_MAX) });
		}
		sizeDraft = null;
	}

	// Enter commits + blurs; Escape discards the draft. stopPropagation keeps the
	// keystrokes out of the editor's global shortcut handler while typing.
	function onNumberKeydown(event: KeyboardEvent, commit: () => void, cancel: () => void) {
		event.stopPropagation();
		const input = event.currentTarget as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			commit();
			input.blur();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancel();
			input.blur();
		}
	}

	// Focusing a field starts editing from the current value and selects it, so
	// the user can just type the new number. Any open preset menu is closed.
	function focusNumber(event: FocusEvent, set: (v: string) => void, current: number) {
		closeDropdowns();
		set(`${current}`);
		(event.currentTarget as HTMLInputElement).select();
	}

	// Icon buttons: the `tb-tip` marker drives the hover tooltip (see the small
	// scoped block below — a pseudo-element with `content: attr(aria-label)` is
	// the one thing Tailwind can't express: its `--tw-content` var overrides the
	// arbitrary `attr()` and the tooltip renders empty). `toggled` is applied via
	// class:toggled where needed; the [&.toggled] rules only bite when present.
	const ICON_BTN = [
		'tb-tip relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border',
		'border-transparent bg-transparent p-0 text-toolbar-text transition-colors duration-[120ms]',
		'[&_svg]:size-[18px] enabled:hover:bg-surface-hover enabled:hover:text-[#1f201d]',
		'disabled:cursor-not-allowed disabled:opacity-[0.32] [&.toggled]:bg-mq-pink [&.toggled]:text-mq-red'
	].join(' ');
	// Bold / Italic / Underline / Color buttons: `tb-tip-data` tooltip = data-tip.
	const FMT_BTN = [
		'tb-tip-data relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border',
		'border-transparent bg-transparent p-0 text-toolbar-text transition-colors duration-[120ms]',
		'hover:bg-surface-hover hover:text-[#1f201d] [&.toggled]:bg-mq-pink [&.toggled]:text-mq-red'
	].join(' ');

	onMount(() => {
		const onPointer = (event: PointerEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.closest('.tb-menu')) return;
			closeDropdowns();
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeDropdowns();
		};
		window.addEventListener('pointerdown', onPointer);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('pointerdown', onPointer);
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

{#snippet icon(name: string)}
	<UiIcon {name} strokeWidth={1.8} />
{/snippet}

<div
	class="relative flex w-full flex-[0_0_46px] items-center gap-1 border-b border-line-soft bg-white
		py-0 pr-14 pl-3 [font-family:system-ui,-apple-system,sans-serif]"
>
	<!-- File -->
	<div class="flex items-center gap-0.5">
		<button type="button" class={ICON_BTN} aria-label="Open file" onclick={editor.open}>
			<FolderOpen size={18} />
		</button>
		<button type="button" class={ICON_BTN} aria-label="Save" onclick={editor.save}>
			<Save size={18} />
		</button>
	</div>

	<div class="mx-1.5 h-[22px] w-px bg-line-soft"></div>

	<!-- History -->
	<div class="flex items-center gap-0.5">
		<button
			type="button"
			class={ICON_BTN}
			aria-label="Undo"
			onclick={editor.undo}
			disabled={!editor.history.canUndo}
		>
			{@render icon('undo')}
		</button>
		<button
			type="button"
			class={ICON_BTN}
			aria-label="Redo"
			onclick={editor.redo}
			disabled={!editor.history.canRedo}
		>
			{@render icon('redo')}
		</button>
	</div>

	<div class="mx-1.5 h-[22px] w-px bg-line-soft"></div>

	<!-- Zoom -->
	<div class="flex items-center gap-0.5">
		<button type="button" class={ICON_BTN} aria-label="Zoom out" onclick={editor.zoomOut}>
			{@render icon('zoom-out')}
		</button>

		<div class="tb-menu relative">
			<div
				class="group inline-flex h-[30px] min-w-[64px] items-center rounded-md border border-line-soft
					bg-transparent pr-0.5 pl-2 transition-colors duration-[120ms] hover:bg-surface-hover
					focus-within:border-mq-red focus-within:bg-white [&.active]:border-mq-red [&.active]:bg-white"
				class:active={openDropdown === 'zoom'}
			>
				<input
					class="w-0 min-w-[26px] flex-1 border-none bg-transparent p-0 text-right text-[0.82rem]
						tabular-nums text-toolbar-text outline-none [appearance:textfield]
						group-focus-within:text-[#1f201d]
						[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					type="text"
					inputmode="numeric"
					aria-label="Zoom level"
					value={zoomDraft ?? `${editor.state.zoomPercent}`}
					oninput={(e) => (zoomDraft = e.currentTarget.value)}
					onfocus={(e) =>
						focusNumber(e, (v) => (zoomDraft = v), editor.state.zoomPercent)}
					onblur={commitZoom}
					onkeydown={(e) => onNumberKeydown(e, commitZoom, () => (zoomDraft = null))}
				/>
				<span class="pointer-events-none mr-px ml-0.5 text-[0.82rem] text-ink-muted">%</span>
				<button
					type="button"
					class="inline-flex h-full w-4 cursor-pointer items-center justify-center border-none
						bg-transparent p-0 text-ink-muted hover:text-toolbar-text [&_svg]:size-3"
					aria-label="Zoom presets"
					aria-haspopup="menu"
					aria-expanded={openDropdown === 'zoom'}
					onclick={() => toggle('zoom')}
				>
					{@render icon('chevron')}
				</button>
			</div>

			{#if openDropdown === 'zoom'}
				<div
					class="absolute top-[calc(100%+6px)] left-0 z-[100] flex max-h-[320px] min-w-[180px]
						flex-col gap-px overflow-y-auto rounded-[10px] border border-line-dropdown bg-white p-1.5
						shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
					role="menu"
				>
					<div class="px-3 pt-1.5 pb-1 text-[0.66rem] font-bold tracking-[0.08em] text-ink-muted">
						ZOOM LEVEL
					</div>
					{#each ZOOM_PRESETS as preset}
						<button
							type="button"
							role="menuitem"
							class="flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none
								bg-transparent px-3 py-[7px] text-left text-[0.86rem] text-ink-soft transition-colors
								duration-100 hover:bg-mq-pink hover:text-mq-maroon [&.checked]:bg-mq-pink
								[&.checked]:text-mq-maroon"
							class:checked={preset === editor.state.zoomPercent}
							onclick={() => pickZoom(preset)}
						>
							<span
								class="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-mq-maroon
									[&_svg]:size-3.5"
							>
								{#if preset === editor.state.zoomPercent}{@render icon('check')}{/if}
							</span>
							<span class="flex-1 text-left tabular-nums">{preset}%</span>
						</button>
					{/each}
					<div class="mx-1 my-1 h-px bg-[#e8e5de]"></div>
					<button
						type="button"
						role="menuitem"
						class="flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none
							bg-transparent px-3 py-[7px] text-left text-[0.86rem] text-ink-soft transition-colors
							duration-100 hover:bg-mq-pink hover:text-mq-maroon"
						onclick={pickFitView}
					>
						<span
							class="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-[#5a5c58]
								[&_svg]:size-[15px]">{@render icon('fit')}</span
						>
						<span class="flex-1 text-left">Fit to screen</span>
					</button>
					<button
						type="button"
						role="menuitem"
						class="flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none
							bg-transparent px-3 py-[7px] text-left text-[0.86rem] text-ink-soft transition-colors
							duration-100 hover:bg-mq-pink hover:text-mq-maroon"
						onclick={pickFitSelection}
					>
						<span
							class="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-[#5a5c58]
								[&_svg]:size-[15px]">{@render icon('fit')}</span
						>
						<span class="flex-1 text-left">Fit selection</span>
					</button>
				</div>
			{/if}
		</div>

		<button type="button" class={ICON_BTN} aria-label="Zoom in" onclick={editor.zoomIn}>
			{@render icon('zoom-in')}
		</button>
		<button type="button" class={ICON_BTN} aria-label="Fit to screen" onclick={editor.fitView}>
			{@render icon('fullscreen')}
		</button>
	</div>

	<div class="mx-1.5 h-[22px] w-px bg-line-soft"></div>

	<!-- Text formatting -->
	<div class="flex items-center gap-0.5">
		<div class="tb-menu relative">
			<button
				type="button"
				class="inline-flex h-[30px] min-w-[104px] cursor-pointer items-center gap-1.5 rounded-md
					border border-line-soft bg-transparent px-2 text-[0.82rem] text-toolbar-text
					transition-colors duration-[120ms] hover:bg-surface-hover hover:text-[#1f201d]
					[&.active]:border-mq-red [&.active]:bg-white [&.active]:text-mq-maroon"
				class:active={openDropdown === 'font'}
				aria-haspopup="menu"
				aria-expanded={openDropdown === 'font'}
				onclick={() => toggle('font')}
			>
				<span
					class="flex-1 overflow-hidden text-left text-ellipsis whitespace-nowrap"
					style="font-family: {style.fontFamily};">{style.fontFamily}</span
				>
				<span class="inline-flex h-3 w-3 text-ink-muted [&_svg]:size-3">{@render icon('chevron')}</span>
			</button>
			{#if openDropdown === 'font'}
				<div
					class="absolute top-[calc(100%+6px)] left-0 z-[100] flex max-h-[320px] min-w-[180px]
						flex-col gap-px overflow-y-auto rounded-[10px] border border-line-dropdown bg-white p-1.5
						shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
					role="menu"
					tabindex="-1"
					onmouseleave={() => editor.endPreview()}
				>
					{#each FONT_FAMILIES as family}
						<button
							type="button"
							role="menuitem"
							class="flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none
								bg-transparent px-3 py-[7px] text-left text-[0.86rem] text-ink-soft transition-colors
								duration-100 hover:bg-mq-pink hover:text-mq-maroon [&.checked]:bg-mq-pink
								[&.checked]:text-mq-maroon"
							class:checked={family === style.fontFamily}
							onclick={() => pickFont(family)}
							onmouseenter={() => editor.previewStyle({ fontFamily: family })}
						>
							<span
								class="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-mq-maroon
									[&_svg]:size-3.5"
							>
								{#if family === style.fontFamily}{@render icon('check')}{/if}
							</span>
							<span class="flex-1 text-left" style="font-family: {family};">{family}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="tb-menu relative">
			<div
				class="group inline-flex h-[30px] min-w-[56px] items-center rounded-md border border-line-soft
					bg-transparent pr-0.5 pl-2 transition-colors duration-[120ms] hover:bg-surface-hover
					focus-within:border-mq-red focus-within:bg-white [&.active]:border-mq-red [&.active]:bg-white"
				class:active={openDropdown === 'size'}
			>
				<input
					class="w-0 min-w-[26px] flex-1 border-none bg-transparent p-0 text-right text-[0.82rem]
						tabular-nums text-toolbar-text outline-none [appearance:textfield]
						group-focus-within:text-[#1f201d]
						[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					type="text"
					inputmode="numeric"
					aria-label="Font size"
					value={sizeDraft ?? `${style.fontSize}`}
					oninput={(e) => (sizeDraft = e.currentTarget.value)}
					onfocus={(e) => focusNumber(e, (v) => (sizeDraft = v), style.fontSize)}
					onblur={commitSize}
					onkeydown={(e) => onNumberKeydown(e, commitSize, () => (sizeDraft = null))}
				/>
				<span class="pointer-events-none mr-px ml-0.5 text-[0.82rem] text-ink-muted">pt</span>
				<button
					type="button"
					class="inline-flex h-full w-4 cursor-pointer items-center justify-center border-none
						bg-transparent p-0 text-ink-muted hover:text-toolbar-text [&_svg]:size-3"
					aria-label="Font size presets"
					aria-haspopup="menu"
					aria-expanded={openDropdown === 'size'}
					onclick={() => toggle('size')}
				>
					{@render icon('chevron')}
				</button>
			</div>
			{#if openDropdown === 'size'}
				<div
					class="absolute top-[calc(100%+6px)] left-0 z-[100] flex max-h-[320px] min-w-[120px] flex-col
						gap-px overflow-y-auto rounded-[10px] border border-line-dropdown bg-white p-1.5
						shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
					role="menu"
					tabindex="-1"
					onmouseleave={() => editor.endPreview()}
				>
					{#each FONT_SIZES as size}
						<button
							type="button"
							role="menuitem"
							class="flex w-full cursor-pointer items-center gap-1.5 rounded-md border-none
								bg-transparent px-3 py-[7px] text-left text-[0.86rem] text-ink-soft transition-colors
								duration-100 hover:bg-mq-pink hover:text-mq-maroon [&.checked]:bg-mq-pink
								[&.checked]:text-mq-maroon"
							class:checked={size === style.fontSize}
							onclick={() => pickSize(size)}
							onmouseenter={() => editor.previewStyle({ fontSize: size })}
						>
							<span
								class="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-mq-maroon
									[&_svg]:size-3.5"
							>
								{#if size === style.fontSize}{@render icon('check')}{/if}
							</span>
							<span class="flex-1 text-left tabular-nums">{size} pt</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<button
			type="button"
			class={FMT_BTN}
			class:toggled={style.bold}
			aria-label="Bold"
			data-tip="Bold (Ctrl+B)"
			aria-pressed={style.bold}
			onclick={() => editor.applyStyle({ bold: !style.bold })}
		>
			<span class="text-[0.95rem] leading-none font-bold">B</span>
		</button>
		<button
			type="button"
			class={FMT_BTN}
			class:toggled={style.italic}
			aria-label="Italic"
			data-tip="Italic (Ctrl+I)"
			aria-pressed={style.italic}
			onclick={() => editor.applyStyle({ italic: !style.italic })}
		>
			<span class="text-[0.95rem] leading-none font-semibold italic [font-family:Georgia,serif]">I</span>
		</button>
		<button
			type="button"
			class={FMT_BTN}
			class:toggled={style.underline}
			aria-label="Underline"
			data-tip="Underline (Ctrl+U)"
			aria-pressed={style.underline}
			onclick={() => editor.applyStyle({ underline: !style.underline })}
		>
			<span class="text-[0.95rem] leading-none font-semibold underline">U</span>
		</button>

		<label class="{FMT_BTN} flex-col gap-px" aria-label="Text color" data-tip="Text color">
			<span class="text-[0.9rem] leading-none font-bold">A</span>
			<span class="h-[3px] w-4 rounded-[1px]" style="background: {swatchColor};"></span>
			<input
				class="absolute inset-0 h-full w-full cursor-pointer border-none p-0 opacity-0"
				type="color"
				value={swatchColor}
				oninput={onTextColorInput}
				onchange={() => (liveTextColor = null)}
			/>
		</label>
	</div>

	<div class="mx-1.5 h-[22px] w-px bg-line-soft"></div>

	<!-- Object -->
	<div class="flex items-center gap-0.5">
		<button
			type="button"
			class={ICON_BTN}
			class:toggled={editor.state.locked}
			aria-label={editor.state.locked ? 'Unlock canvas' : 'Lock canvas'}
			aria-pressed={editor.state.locked}
			onclick={editor.toggleLock}
		>
			{@render icon(editor.state.locked ? 'lock-closed' : 'lock-open')}
		</button>
		<button type="button" class={ICON_BTN} aria-label="Copy" onclick={editor.copy}>
			{@render icon('copy')}
		</button>
		<button type="button" class={ICON_BTN} aria-label="Delete" onclick={editor.deleteSelected}>
			{@render icon('delete')}
		</button>
	</div>

	<!-- Style-panel toggle: PINNED to the toolbar's right corner (absolute, out
	     of the icon flow) so it stays glued to the screen edge no matter how
	     crowded the toolbar gets. Root is `relative` + `pr-14` reserves its
	     lane so flowing icons never slide underneath. -->
	<div class="absolute top-1/2 right-3 -translate-y-1/2">
		<button
			type="button"
			class={ICON_BTN}
			class:toggled={editor.state.showStylePanel}
			aria-label={editor.state.showStylePanel ? 'Hide style panel' : 'Show style panel'}
			aria-pressed={editor.state.showStylePanel}
			onclick={editor.toggleStylePanel}
		>
			{@render icon('style-panel')}
		</button>
	</div>
</div>

<style>
	/*
	 * Hover tooltip — the ONLY thing kept as scoped CSS in this file. A
	 * pseudo-element whose text comes from `content: attr(...)` can't be a
	 * Tailwind utility: Tailwind's `content` support routes through a
	 * `--tw-content` custom property (initial value ""), which wins over the
	 * arbitrary `attr()` and leaves the tooltip empty. `.tb-tip` reads
	 * aria-label (icon buttons); `.tb-tip-data` reads data-tip (B/I/U/color).
	 * Everything else in the toolbar is Tailwind. The host buttons are already
	 * `relative` via ICON_BTN / FMT_BTN, so the absolute tip anchors to them.
	 */
	.tb-tip::after,
	.tb-tip-data::after {
		position: absolute;
		top: calc(100% + 7px);
		left: 50%;
		transform: translateX(-50%);
		background: #373a36;
		color: #fff;
		font-family: system-ui, -apple-system, sans-serif;
		font-size: 0.72rem;
		font-weight: 500;
		padding: 4px 8px;
		border-radius: 4px;
		white-space: nowrap;
		z-index: 200;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.12s ease;
	}
	.tb-tip::after {
		content: attr(aria-label);
	}
	.tb-tip-data::after {
		content: attr(data-tip);
	}
	.tb-tip:hover::after,
	.tb-tip-data:hover::after {
		opacity: 1;
		transition-delay: 0.45s;
	}
</style>
