<script module lang="ts">
	export type TextAlign = 'left' | 'center' | 'right';

	export interface NodeStyleData {
		fillColor?: string;
		borderColor?: string;
		borderWidth?: number;
		rounded?: boolean;
		shadow?: boolean;
		textColor?: string;
		fontFamily?: string;
		fontSize?: number;
		bold?: boolean;
		italic?: boolean;
		underline?: boolean;
		textAlign?: TextAlign;
	}
</script>

<script lang="ts">
	import type { Node } from '@xyflow/svelte';
	import { getShape } from '$lib/flow/nodes/registry';
	import { FONT_FAMILIES, DEFAULT_FONT_FAMILY } from '$lib/fonts';
	import ColorField from '$lib/components/ColorField.svelte';

	type StyleTab = 'style' | 'text' | 'panel' | 'arrange';

	interface Props {
		node: Node;
		/**
		 * Generic data patcher. Receives a Partial<NodeStyleData> for the
		 * Style/Text tabs and a Partial<NodeData> for shape-specific panels.
		 * Flow merges the patch into node.data either way.
		 */
		onStyleChange: (patch: Partial<NodeStyleData> & Record<string, unknown>) => void;
		onPositionChange: (x: number, y: number) => void;
		onSizeChange: (width: number, height: number) => void;
		onBringToFront: () => void;
		onSendToBack: () => void;
		onDuplicate: () => void;
		onDelete: () => void;
	}

	let {
		node,
		onStyleChange,
		onPositionChange,
		onSizeChange,
		onBringToFront,
		onSendToBack,
		onDuplicate,
		onDelete
	}: Props = $props();

	let activeTab: StyleTab = $state('style');

	// The shape registry tells us whether the selected node ships a custom
	// editor tab (e.g. EntityNode's Fields editor). No node-type-specific
	// branching here — StylePanel stays generic.
	let shape = $derived(node.type ? getShape(node.type) : undefined);
	let customPanel = $derived(shape?.panel);

	// If the user navigates to a node whose shape doesn't expose a custom
	// panel while that tab is active, fall back to Style.
	$effect(() => {
		if (!customPanel && activeTab === 'panel') {
			activeTab = 'style';
		}
	});

	// White leads: it's the default fill of every shape (and now the entity
	// header), so the row starts on the swatch that's actually active.
	const FILL_COLORS = ['#FFFFFF', '#76232F', '#A6192E', '#6B4DBA', '#0E7E63', '#9C6B1A'];
	const TEXT_COLORS = ['#2C2C2A', '#FFFFFF', '#A6192E', '#6B4DBA', '#0E7E63', '#9C6B1A'];
	const TEXT_ALIGNMENTS: TextAlign[] = ['left', 'center', 'right'];

	// The style fields live on node.data so they survive page snapshots.
	let style = $derived((node.data ?? {}) as NodeStyleData);

	// Matches the real rendered default: ShapeNode falls back to white, and
	// the entity header is white too — so the panel opens showing the truth.
	let fillColor = $derived(style.fillColor ?? '#FFFFFF');
	let borderColor = $derived(style.borderColor ?? '#2C2C2A');
	let borderWidth = $derived(style.borderWidth ?? 1);
	let rounded = $derived(style.rounded ?? false);
	let shadow = $derived(style.shadow ?? false);

	let textColor = $derived(style.textColor ?? '#2C2C2A');
	let fontFamily = $derived(style.fontFamily ?? DEFAULT_FONT_FAMILY);
	let fontSize = $derived(style.fontSize ?? 14);
	let bold = $derived(style.bold ?? false);
	let italic = $derived(style.italic ?? false);
	let underline = $derived(style.underline ?? false);
	let textAlign: TextAlign = $derived(style.textAlign ?? 'center');

	// Arrange tab pulls live values from the node, but inputs need local state
	// so we can debounce commits until blur/Enter.
	let nodeX = $derived(Math.round(node.position?.x ?? 0));
	let nodeY = $derived(Math.round(node.position?.y ?? 0));
	let nodeW = $derived(
		Math.round((node.measured?.width as number) ?? (node.width as number) ?? 0)
	);
	let nodeH = $derived(
		Math.round((node.measured?.height as number) ?? (node.height as number) ?? 0)
	);

	let xInput = $state(0);
	let yInput = $state(0);
	let wInput = $state(0);
	let hInput = $state(0);

	// Seed and re-seed inputs from the selected node's live geometry.
	$effect(() => {
		xInput = nodeX;
	});
	$effect(() => {
		yInput = nodeY;
	});
	$effect(() => {
		wInput = nodeW;
	});
	$effect(() => {
		hInput = nodeH;
	});

	const BORDER_WIDTH_MAX = 10;

	function adjustBorderWidth(delta: number) {
		const next = Math.max(0, Math.min(BORDER_WIDTH_MAX, borderWidth + delta));
		onStyleChange({ borderWidth: next });
	}

	// Editable border-width field (same draft pattern as font size below).
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
	// only renders in a DOM menu we own. The menu escapes .style-panel's
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
	// when .content scrolls under it).
	$effect(() => {
		if (!fontMenuOpen) return;
		const onPointerDown = (e: PointerEvent) => {
			// instanceof narrows to the DOM Node type (the bare `Node` TYPE name
			// is shadowed by xyflow's Node import in this file).
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

	function commitPosition() {
		onPositionChange(xInput, yInput);
	}

	function commitSize() {
		onSizeChange(Math.max(1, wInput), Math.max(1, hInput));
	}

	// Repeated building blocks factored out so the markup stays readable. State
	// classes (active / is-white / danger) are still applied via class:… on the
	// element; the [&.…] rules here only bite when that class is present.
	const GROUP = 'flex flex-col gap-2.5';
	const GROUP_LABEL = 'm-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon';
	const ROW = 'flex items-center justify-between gap-2';
	const ROW_LABEL = 'text-[0.85rem] text-ink-soft';
	const STEPPER = 'inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-1 py-0.5';
	const STEPPER_BTN =
		'h-[22px] w-[22px] cursor-pointer rounded border-none bg-transparent text-base leading-none text-ink-soft hover:bg-[#edebe5]';
	const SIZE_INPUT = [
		'w-8 min-w-0 border-none bg-transparent p-0 text-center text-[0.85rem] text-ink-soft outline-none',
		'[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
	].join(' ');
	const SQUARE_BTN = [
		'flex cursor-pointer items-center justify-center rounded-md border border-line bg-white py-3.5',
		'text-[0.95rem] text-ink-soft transition-colors duration-[120ms] hover:border-[#c4c1b8]',
		'[&.active]:border-mq-red [&.active]:bg-mq-pink [&.active]:text-mq-maroon'
	].join(' ');
	const TOGGLE = 'relative inline-block h-5 w-9 flex-shrink-0';
	const TOGGLE_SLIDER = [
		'absolute inset-0 cursor-pointer rounded-full bg-[#c4c1b8] transition-colors duration-150',
		"before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full",
		"before:bg-white before:shadow-[0_1px_2px_rgba(0,0,0,0.15)] before:transition-transform",
		"before:duration-150 before:content-[''] peer-checked:bg-mq-red peer-checked:before:translate-x-4"
	].join(' ');
	const SWATCH = [
		'aspect-square cursor-pointer rounded border border-transparent p-0',
		'transition-[transform,box-shadow] duration-100 hover:-translate-y-px',
		'[&.is-white]:border-line [&.active]:shadow-[0_0_0_2px_#76232f]'
	].join(' ');
	const ACTION_BTN = [
		'cursor-pointer rounded-md border border-line bg-white p-2.5 text-[0.85rem] text-ink-soft',
		'transition-colors duration-[120ms] hover:border-mq-maroon hover:text-mq-maroon'
	].join(' ');
	const ACTION_BTN_DANGER = [
		'cursor-pointer rounded-md border border-mq-red bg-white p-2.5 text-[0.85rem] text-mq-red',
		'transition-colors duration-[120ms] hover:bg-[#fdf2f1]'
	].join(' ');
</script>

<aside
	class="absolute top-4 right-4 z-50 flex max-h-[calc(100%-32px)] w-[280px] flex-col overflow-hidden
		rounded-xl border border-line bg-panel font-sans shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
>
	<div class="flex flex-shrink-0 border-b border-line" role="tablist" aria-label="Node styling tabs">
		{#snippet tab(id: StyleTab, label: string)}
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === id}
				class="relative flex-1 cursor-pointer border-none bg-transparent py-3.5 text-[0.88rem]
					text-ink-soft transition-colors duration-[120ms] hover:text-mq-maroon
					[&.active]:font-semibold [&.active]:text-mq-maroon [&.active]:after:absolute
					[&.active]:after:right-3 [&.active]:after:bottom-[-1px] [&.active]:after:left-3
					[&.active]:after:h-0.5 [&.active]:after:rounded-[1px] [&.active]:after:bg-mq-maroon
					[&.active]:after:content-['']"
				class:active={activeTab === id}
				onclick={() => (activeTab = id)}
			>
				{label}
			</button>
		{/snippet}
		{@render tab('style', 'Style')}
		{@render tab('text', 'Text')}
		{#if customPanel}
			{@render tab('panel', customPanel.label)}
		{/if}
		{@render tab('arrange', 'Arrange')}
	</div>

	<div class="flex flex-col gap-5 overflow-y-auto p-[18px]">
		{#if activeTab === 'style'}
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
				<div class={ROW}>
					<span class={ROW_LABEL}>Rounded corners</span>
					<label class={TOGGLE}>
						<input
							class="peer h-0 w-0 opacity-0"
							type="checkbox"
							checked={rounded}
							onchange={(e) => onStyleChange({ rounded: e.currentTarget.checked })}
						/>
						<span class={TOGGLE_SLIDER}></span>
					</label>
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
		{:else if activeTab === 'text'}
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
		{:else if activeTab === 'panel' && customPanel}
			{@const PanelComponent = customPanel.component}
			<PanelComponent {node} onDataChange={onStyleChange} />
		{:else}
			<section class={GROUP}>
				<h3 class={GROUP_LABEL}>POSITION</h3>
				<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
					<label
						class="flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-white px-2
							focus-within:border-mq-red"
					>
						<span class="flex-shrink-0 text-[0.78rem] font-semibold text-mq-maroon">X</span>
						<input
							class="min-w-0 flex-1 border-none bg-transparent py-2 text-[0.85rem] tabular-nums
								outline-none [appearance:textfield]
								[&::-webkit-inner-spin-button]:appearance-none
								[&::-webkit-outer-spin-button]:appearance-none"
							type="number"
							bind:value={xInput}
							onchange={commitPosition}
							onblur={commitPosition}
						/>
					</label>
					<label
						class="flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-white px-2
							focus-within:border-mq-red"
					>
						<span class="flex-shrink-0 text-[0.78rem] font-semibold text-mq-maroon">Y</span>
						<input
							class="min-w-0 flex-1 border-none bg-transparent py-2 text-[0.85rem] tabular-nums
								outline-none [appearance:textfield]
								[&::-webkit-inner-spin-button]:appearance-none
								[&::-webkit-outer-spin-button]:appearance-none"
							type="number"
							bind:value={yInput}
							onchange={commitPosition}
							onblur={commitPosition}
						/>
					</label>
				</div>
			</section>

			<section class={GROUP}>
				<h3 class={GROUP_LABEL}>SIZE</h3>
				<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
					<label
						class="flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-white px-2
							focus-within:border-mq-red"
					>
						<span class="flex-shrink-0 text-[0.78rem] font-semibold text-mq-maroon">W</span>
						<input
							class="min-w-0 flex-1 border-none bg-transparent py-2 text-[0.85rem] tabular-nums
								outline-none [appearance:textfield]
								[&::-webkit-inner-spin-button]:appearance-none
								[&::-webkit-outer-spin-button]:appearance-none"
							type="number"
							bind:value={wInput}
							onchange={commitSize}
							onblur={commitSize}
						/>
					</label>
					<label
						class="flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-white px-2
							focus-within:border-mq-red"
					>
						<span class="flex-shrink-0 text-[0.78rem] font-semibold text-mq-maroon">H</span>
						<input
							class="min-w-0 flex-1 border-none bg-transparent py-2 text-[0.85rem] tabular-nums
								outline-none [appearance:textfield]
								[&::-webkit-inner-spin-button]:appearance-none
								[&::-webkit-outer-spin-button]:appearance-none"
							type="number"
							bind:value={hInput}
							onchange={commitSize}
							onblur={commitSize}
						/>
					</label>
				</div>
			</section>

			<section class={GROUP}>
				<h3 class={GROUP_LABEL}>ORDER</h3>
				<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
					<button type="button" class={ACTION_BTN} onclick={onBringToFront}>To front</button>
					<button type="button" class={ACTION_BTN} onclick={onSendToBack}>To back</button>
				</div>
			</section>

			<section class={GROUP}>
				<h3 class={GROUP_LABEL}>ACTIONS</h3>
				<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
					<button type="button" class={ACTION_BTN} onclick={onDuplicate}>Duplicate</button>
					<button type="button" class={ACTION_BTN_DANGER} onclick={onDelete}>Delete</button>
				</div>
			</section>
		{/if}
	</div>
</aside>

