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
</script>

<aside class="style-panel">
	<div class="tabs" role="tablist" aria-label="Node styling tabs">
		<button
			type="button"
			role="tab"
			aria-selected={activeTab === 'style'}
			class:active={activeTab === 'style'}
			onclick={() => (activeTab = 'style')}
		>
			Style
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={activeTab === 'text'}
			class:active={activeTab === 'text'}
			onclick={() => (activeTab = 'text')}
		>
			Text
		</button>
		{#if customPanel}
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'panel'}
				class:active={activeTab === 'panel'}
				onclick={() => (activeTab = 'panel')}
			>
				{customPanel.label}
			</button>
		{/if}
		<button
			type="button"
			role="tab"
			aria-selected={activeTab === 'arrange'}
			class:active={activeTab === 'arrange'}
			onclick={() => (activeTab = 'arrange')}
		>
			Arrange
		</button>
	</div>

	<div class="content">
		{#if activeTab === 'style'}
			<section class="group">
				<h3 class="group-label">FILL</h3>
				<div class="swatch-row">
					{#each FILL_COLORS as color}
						<button
							type="button"
							class="swatch"
							class:active={fillColor.toUpperCase() === color}
							class:is-white={color === '#FFFFFF'}
							style="background-color: {color}"
							aria-label="Fill {color}"
							onclick={() => onStyleChange({ fillColor: color })}
						></button>
					{/each}
				</div>
				<div class="row">
					<span class="row-label">Custom</span>
					<ColorField
						value={fillColor}
						label="Fill"
						onChange={(hex) => onStyleChange({ fillColor: hex })}
					/>
				</div>
			</section>

			<section class="group">
				<h3 class="group-label">BORDER</h3>
				<div class="row">
					<span class="row-label">Color</span>
					<ColorField
						value={borderColor}
						label="Border"
						onChange={(hex) => onStyleChange({ borderColor: hex })}
					/>
				</div>
				<div class="row">
					<span class="row-label">Width</span>
					<div class="stepper">
						<button
							type="button"
							aria-label="Decrease width"
							onclick={() => adjustBorderWidth(-1)}>−</button
						>
						<input
							class="size-input tabular"
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
							aria-label="Increase width"
							onclick={() => adjustBorderWidth(1)}>+</button
						>
					</div>
				</div>
			</section>

			<section class="group">
				<h3 class="group-label">EFFECTS</h3>
				<div class="row">
					<span class="row-label">Rounded corners</span>
					<label class="toggle">
						<input
							type="checkbox"
							checked={rounded}
							onchange={(e) => onStyleChange({ rounded: e.currentTarget.checked })}
						/>
						<span class="toggle-slider"></span>
					</label>
				</div>
				<div class="row">
					<span class="row-label">Shadow</span>
					<label class="toggle">
						<input
							type="checkbox"
							checked={shadow}
							onchange={(e) => onStyleChange({ shadow: e.currentTarget.checked })}
						/>
						<span class="toggle-slider"></span>
					</label>
				</div>
			</section>
		{:else if activeTab === 'text'}
			<section class="group">
				<h3 class="group-label">COLOR</h3>
				<div class="swatch-row">
					{#each TEXT_COLORS as color}
						<button
							type="button"
							class="swatch"
							class:active={textColor.toUpperCase() === color}
							class:is-white={color === '#FFFFFF'}
							style="background-color: {color}"
							aria-label="Text color {color}"
							onclick={() => onStyleChange({ textColor: color })}
						></button>
					{/each}
				</div>
				<div class="row">
					<span class="row-label">Custom</span>
					<ColorField
						value={textColor}
						label="Text"
						onChange={(hex) => onStyleChange({ textColor: hex })}
					/>
				</div>
			</section>

			<section class="group">
				<h3 class="group-label">FONT</h3>
				<div class="font-field">
					<button
						type="button"
						class="font-select"
						bind:this={fontTriggerEl}
						style="font-family: {fontFamily};"
						aria-haspopup="listbox"
						aria-expanded={fontMenuOpen}
						aria-label="Font family"
						onclick={toggleFontMenu}
					>
						{fontFamily}
					</button>
					<span class="font-chev" aria-hidden="true">
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
							class="font-menu"
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
									class="font-option"
									onclick={() => pickFont(family)}
								>
									<span class="font-option-check">
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
				<div class="row">
					<span class="row-label">Size</span>
					<div class="stepper">
						<button
							type="button"
							aria-label="Decrease font size"
							onclick={() => adjustFontSize(-1)}>−</button
						>
						<input
							class="size-input tabular"
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
							aria-label="Increase font size"
							onclick={() => adjustFontSize(1)}>+</button
						>
					</div>
				</div>
			</section>

			<section class="group">
				<h3 class="group-label">STYLE</h3>
				<div class="grid-3">
					<button
						type="button"
						class="square-btn"
						class:active={bold}
						aria-label="Bold"
						aria-pressed={bold}
						onclick={() => onStyleChange({ bold: !bold })}
					>
						<span style="font-weight: 700">B</span>
					</button>
					<button
						type="button"
						class="square-btn"
						class:active={italic}
						aria-label="Italic"
						aria-pressed={italic}
						onclick={() => onStyleChange({ italic: !italic })}
					>
						<span style="font-style: italic">I</span>
					</button>
					<button
						type="button"
						class="square-btn"
						class:active={underline}
						aria-label="Underline"
						aria-pressed={underline}
						onclick={() => onStyleChange({ underline: !underline })}
					>
						<span style="text-decoration: underline">U</span>
					</button>
				</div>
			</section>

			<section class="group">
				<h3 class="group-label">ALIGNMENT</h3>
				<div class="grid-3">
					{#each TEXT_ALIGNMENTS as align}
						<button
							type="button"
							class="square-btn"
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
			<section class="group">
				<h3 class="group-label">POSITION</h3>
				<div class="grid-2">
					<label class="labeled-input">
						<span class="prefix">X</span>
						<input
							type="number"
							bind:value={xInput}
							onchange={commitPosition}
							onblur={commitPosition}
						/>
					</label>
					<label class="labeled-input">
						<span class="prefix">Y</span>
						<input
							type="number"
							bind:value={yInput}
							onchange={commitPosition}
							onblur={commitPosition}
						/>
					</label>
				</div>
			</section>

			<section class="group">
				<h3 class="group-label">SIZE</h3>
				<div class="grid-2">
					<label class="labeled-input">
						<span class="prefix">W</span>
						<input
							type="number"
							bind:value={wInput}
							onchange={commitSize}
							onblur={commitSize}
						/>
					</label>
					<label class="labeled-input">
						<span class="prefix">H</span>
						<input
							type="number"
							bind:value={hInput}
							onchange={commitSize}
							onblur={commitSize}
						/>
					</label>
				</div>
			</section>

			<section class="group">
				<h3 class="group-label">ORDER</h3>
				<div class="grid-2">
					<button type="button" class="action-btn" onclick={onBringToFront}
						>To front</button
					>
					<button type="button" class="action-btn" onclick={onSendToBack}>To back</button>
				</div>
			</section>

			<section class="group">
				<h3 class="group-label">ACTIONS</h3>
				<div class="grid-2">
					<button type="button" class="action-btn" onclick={onDuplicate}>Duplicate</button
					>
					<button type="button" class="action-btn danger" onclick={onDelete}
						>Delete</button
					>
				</div>
			</section>
		{/if}
	</div>
</aside>

<style>
	.style-panel {
		position: absolute;
		top: 16px;
		right: 16px;
		width: 280px;
		background: #f5f3ef;
		border: 1px solid #d6d2c4;
		border-radius: 12px;
		padding: 0;
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
		z-index: 50;
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif;
		max-height: calc(100% - 32px);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.tabs {
		display: flex;
		border-bottom: 1px solid #d6d2c4;
		flex-shrink: 0;
	}

	.tabs button {
		flex: 1;
		background: transparent;
		border: none;
		padding: 14px 0;
		font-family: inherit;
		font-size: 0.88rem;
		color: #373a36;
		cursor: pointer;
		position: relative;
		transition: color 0.12s ease;
	}

	.tabs button:hover {
		color: #76232f;
	}

	.tabs button.active {
		color: #76232f;
		font-weight: 600;
	}

	.tabs button.active::after {
		content: '';
		position: absolute;
		bottom: -1px;
		left: 12px;
		right: 12px;
		height: 2px;
		background: #76232f;
		border-radius: 1px;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 18px;
		overflow-y: auto;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.group-label {
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		font-weight: 700;
		color: #76232f;
		margin: 0;
	}

	.swatch-row {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 6px;
	}

	.swatch {
		aspect-ratio: 1;
		border: 1px solid transparent;
		border-radius: 4px;
		cursor: pointer;
		padding: 0;
		transition:
			transform 0.1s ease,
			box-shadow 0.1s ease;
	}

	.swatch.is-white {
		border-color: #d6d2c4;
	}

	.swatch.active {
		box-shadow: 0 0 0 2px #76232f;
	}

	.swatch:hover {
		transform: translateY(-1px);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.row-label {
		font-size: 0.85rem;
		color: #373a36;
	}

	.stepper {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 6px;
		padding: 2px 4px;
	}

	/* Font family dropdown: a custom menu, NOT a native <select> — Chromium on
	   Windows paints the native option popup with the OS control and ignores
	   per-option font-family, killing the live typeface preview. The menu
	   escapes the panel's overflow:hidden via position:fixed (coords computed
	   in toggleFontMenu). Closed control + every option render in their own
	   typeface. */
	.font-field {
		position: relative;
	}

	.font-select {
		width: 100%;
		appearance: none;
		-webkit-appearance: none;
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 6px;
		padding: 9px 30px 9px 10px;
		font-size: 0.9rem;
		color: #373a36;
		cursor: pointer;
		line-height: 1.2;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.font-select:hover {
		border-color: #c4c1b8;
	}

	.font-select:focus {
		outline: none;
		border-color: #a6192e;
	}

	.font-chev {
		position: absolute;
		top: 50%;
		right: 10px;
		transform: translateY(-50%);
		display: inline-flex;
		color: #8a8b83;
		pointer-events: none;
	}

	.font-menu {
		position: fixed;
		z-index: 120;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px;
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 8px;
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.14);
		overflow-y: auto;
	}

	.font-option {
		display: flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		border: none;
		border-radius: 6px;
		padding: 7px 10px;
		font-size: 0.9rem;
		color: #373a36;
		text-align: left;
		cursor: pointer;
		white-space: nowrap;
	}

	.font-option:hover {
		background: #f3f1ea;
	}

	/* Fixed-width slot so option text lines up whether or not it's checked. */
	.font-option-check {
		width: 14px;
		display: inline-flex;
		flex-shrink: 0;
		color: #a6192e;
	}

	.size-input {
		width: 32px;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		text-align: center;
		font-family: inherit;
		font-size: 0.85rem;
		color: #373a36;
		padding: 0;
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.size-input::-webkit-outer-spin-button,
	.size-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		appearance: none;
		margin: 0;
	}


	.stepper button {
		background: transparent;
		border: none;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		cursor: pointer;
		color: #373a36;
		font-size: 1rem;
		line-height: 1;
		font-family: inherit;
	}

	.stepper button:hover {
		background: #edebe5;
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
		background: #c4c1b8;
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

	.grid-3 {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}

	.grid-2 {
		display: grid;
		/* minmax(0, 1fr) — not the default minmax(auto, 1fr) — so the two
		   columns can shrink below their content's intrinsic width. Without
		   this the number inputs' default width forces the row past the 280px
		   panel and the content area shows a horizontal scrollbar. */
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 8px;
	}

	.square-btn {
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 6px;
		padding: 14px 0;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.95rem;
		color: #373a36;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease;
	}

	.square-btn:hover {
		border-color: #c4c1b8;
	}

	.square-btn.active {
		border-color: #a6192e;
		background: #fbeef0;
		color: #76232f;
	}

	.labeled-input {
		display: flex;
		align-items: center;
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 6px;
		padding: 0 8px;
		gap: 6px;
		/* Grid item must be allowed to shrink below its content's min-content,
		   otherwise the number input inside keeps the whole cell too wide. */
		min-width: 0;
	}

	.labeled-input:focus-within {
		border-color: #a6192e;
	}

	.labeled-input .prefix {
		font-size: 0.78rem;
		color: #76232f;
		font-weight: 600;
		flex-shrink: 0;
	}

	.labeled-input input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		padding: 8px 0;
		font-size: 0.85rem;
		background: transparent;
		font-family: inherit;
		font-variant-numeric: tabular-nums;
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.labeled-input input::-webkit-outer-spin-button,
	.labeled-input input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		appearance: none;
		margin: 0;
	}

	.action-btn {
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 6px;
		padding: 10px;
		font-family: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		color: #373a36;
		transition:
			background 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease;
	}

	.action-btn:hover {
		border-color: #76232f;
		color: #76232f;
	}

	.action-btn.danger {
		border-color: #a6192e;
		color: #a6192e;
	}

	.action-btn.danger:hover {
		background: #fdf2f1;
	}
</style>
