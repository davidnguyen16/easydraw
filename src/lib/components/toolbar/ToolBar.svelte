<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { FolderOpen, Save } from '@lucide/svelte';
	import { FONT_FAMILIES } from '$lib/fonts';
	import type { NodeStyleData } from '$lib/components/StylePanel.svelte';

	interface NodeTextStyle {
		fontFamily: string;
		fontSize: number;
		bold: boolean;
		italic: boolean;
		underline: boolean;
		textColor: string;
	}

	interface EditorContext {
		state: { zoomPercent: number; locked: boolean };
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
		copy: () => void;
		duplicate: () => void;
		deleteSelected: () => void;
		// Text formatting of the selected node (null when nothing is selected).
		nodeStyle: NodeTextStyle | null;
		applyStyle: (patch: NodeStyleData) => void;
	}

	const editor = getContext<EditorContext>('editor');

	const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200];
	const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 24, 36, 48, 64];

	// Single open-dropdown tracker for the three menus (zoom / font / size).
	let openDropdown = $state<'zoom' | 'font' | 'size' | null>(null);
	const toggle = (name: 'zoom' | 'font' | 'size') =>
		(openDropdown = openDropdown === name ? null : name);
	const closeDropdowns = () => (openDropdown = null);

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
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.8"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		{#if name === 'undo'}
			<polyline points="9 14 4 9 9 4" />
			<path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5h-4" />
		{:else if name === 'redo'}
			<polyline points="15 14 20 9 15 4" />
			<path d="M20 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h4" />
		{:else if name === 'zoom-in'}
			<circle cx="11" cy="11" r="7" />
			<line x1="20" y1="20" x2="16" y2="16" />
			<line x1="11" y1="8" x2="11" y2="14" />
			<line x1="8" y1="11" x2="14" y2="11" />
		{:else if name === 'zoom-out'}
			<circle cx="11" cy="11" r="7" />
			<line x1="20" y1="20" x2="16" y2="16" />
			<line x1="8" y1="11" x2="14" y2="11" />
		{:else if name === 'fullscreen'}
			<polyline points="9 4 4 4 4 9" />
			<polyline points="15 4 20 4 20 9" />
			<polyline points="9 20 4 20 4 15" />
			<polyline points="15 20 20 20 20 15" />
		{:else if name === 'lock-closed'}
			<rect x="5" y="11" width="14" height="10" rx="2" />
			<path d="M8 11V7a4 4 0 0 1 8 0v4" />
		{:else if name === 'lock-open'}
			<rect x="5" y="11" width="14" height="10" rx="2" />
			<path d="M8 11V7a4 4 0 0 1 7.5 -2" />
		{:else if name === 'copy'}
			<rect x="9" y="9" width="11" height="11" rx="2" />
			<path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
		{:else if name === 'delete'}
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
			<path d="M10 11v6" />
			<path d="M14 11v6" />
			<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
		{:else if name === 'chevron'}
			<polyline points="6 9 12 15 18 9" />
		{:else if name === 'check'}
			<polyline points="5 12 10 17 19 8" />
		{:else if name === 'fit'}
			<polyline points="4 9 4 4 9 4" />
			<polyline points="20 9 20 4 15 4" />
			<polyline points="4 15 4 20 9 20" />
			<polyline points="20 15 20 20 15 20" />
		{/if}
	</svg>
{/snippet}

<div class="toolbar">
	<!-- File -->
	<div class="group">
		<button type="button" class="icon-btn" aria-label="Open file" onclick={editor.open}>
			<FolderOpen size={18} />
		</button>
		<button type="button" class="icon-btn" aria-label="Save" onclick={editor.save}>
			<Save size={18} />
		</button>
	</div>

	<div class="separator"></div>

	<!-- History -->
	<div class="group">
		<button
			type="button"
			class="icon-btn"
			aria-label="Undo"
			onclick={editor.undo}
			disabled={!editor.history.canUndo}
		>
			{@render icon('undo')}
		</button>
		<button
			type="button"
			class="icon-btn"
			aria-label="Redo"
			onclick={editor.redo}
			disabled={!editor.history.canRedo}
		>
			{@render icon('redo')}
		</button>
	</div>

	<div class="separator"></div>

	<!-- Zoom -->
	<div class="group">
		<button type="button" class="icon-btn" aria-label="Zoom out" onclick={editor.zoomOut}>
			{@render icon('zoom-out')}
		</button>

		<div class="tb-menu">
			<div class="num-combo" class:active={openDropdown === 'zoom'}>
				<input
					class="num-input tabular"
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
				<span class="num-suffix">%</span>
				<button
					type="button"
					class="num-chev"
					aria-label="Zoom presets"
					aria-haspopup="menu"
					aria-expanded={openDropdown === 'zoom'}
					onclick={() => toggle('zoom')}
				>
					{@render icon('chevron')}
				</button>
			</div>

			{#if openDropdown === 'zoom'}
				<div class="dropdown" role="menu">
					<div class="section-label">ZOOM LEVEL</div>
					{#each ZOOM_PRESETS as preset}
						<button
							type="button"
							role="menuitem"
							class="menu-item"
							class:checked={preset === editor.state.zoomPercent}
							onclick={() => pickZoom(preset)}
						>
							<span class="check">
								{#if preset === editor.state.zoomPercent}{@render icon(
										'check'
									)}{/if}
							</span>
							<span class="grow tabular">{preset}%</span>
						</button>
					{/each}
					<div class="divider"></div>
					<button type="button" role="menuitem" class="menu-item" onclick={pickFitView}>
						<span class="leading-icon">{@render icon('fit')}</span>
						<span class="grow">Fit to screen</span>
					</button>
					<button
						type="button"
						role="menuitem"
						class="menu-item"
						onclick={pickFitSelection}
					>
						<span class="leading-icon">{@render icon('fit')}</span>
						<span class="grow">Fit selection</span>
					</button>
				</div>
			{/if}
		</div>

		<button type="button" class="icon-btn" aria-label="Zoom in" onclick={editor.zoomIn}>
			{@render icon('zoom-in')}
		</button>
		<button type="button" class="icon-btn" aria-label="Fit to screen" onclick={editor.fitView}>
			{@render icon('fullscreen')}
		</button>
	</div>

	<div class="separator"></div>

	<!-- Text formatting -->
	<div class="group">
		<div class="tb-menu">
			<button
				type="button"
				class="text-trigger wide"
				class:active={openDropdown === 'font'}
				aria-haspopup="menu"
				aria-expanded={openDropdown === 'font'}
				onclick={() => toggle('font')}
			>
				<span class="grow ellipsis" style="font-family: {style.fontFamily};"
					>{style.fontFamily}</span
				>
				<span class="chev">{@render icon('chevron')}</span>
			</button>
			{#if openDropdown === 'font'}
				<div class="dropdown" role="menu">
					{#each FONT_FAMILIES as family}
						<button
							type="button"
							role="menuitem"
							class="menu-item"
							class:checked={family === style.fontFamily}
							onclick={() => pickFont(family)}
						>
							<span class="check">
								{#if family === style.fontFamily}{@render icon('check')}{/if}
							</span>
							<span class="grow" style="font-family: {family};">{family}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="tb-menu">
			<div class="num-combo size-combo" class:active={openDropdown === 'size'}>
				<input
					class="num-input tabular"
					type="text"
					inputmode="numeric"
					aria-label="Font size"
					value={sizeDraft ?? `${style.fontSize}`}
					oninput={(e) => (sizeDraft = e.currentTarget.value)}
					onfocus={(e) => focusNumber(e, (v) => (sizeDraft = v), style.fontSize)}
					onblur={commitSize}
					onkeydown={(e) => onNumberKeydown(e, commitSize, () => (sizeDraft = null))}
				/>
				<span class="num-suffix">pt</span>
				<button
					type="button"
					class="num-chev"
					aria-label="Font size presets"
					aria-haspopup="menu"
					aria-expanded={openDropdown === 'size'}
					onclick={() => toggle('size')}
				>
					{@render icon('chevron')}
				</button>
			</div>
			{#if openDropdown === 'size'}
				<div class="dropdown narrow" role="menu">
					{#each FONT_SIZES as size}
						<button
							type="button"
							role="menuitem"
							class="menu-item"
							class:checked={size === style.fontSize}
							onclick={() => pickSize(size)}
						>
							<span class="check">
								{#if size === style.fontSize}{@render icon('check')}{/if}
							</span>
							<span class="grow tabular">{size} pt</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<button
			type="button"
			class="fmt-btn"
			class:toggled={style.bold}
			aria-label="Bold"
			data-tip="Bold (Ctrl+B)"
			aria-pressed={style.bold}
			onclick={() => editor.applyStyle({ bold: !style.bold })}
		>
			<span class="fmt b">B</span>
		</button>
		<button
			type="button"
			class="fmt-btn"
			class:toggled={style.italic}
			aria-label="Italic"
			data-tip="Italic (Ctrl+I)"
			aria-pressed={style.italic}
			onclick={() => editor.applyStyle({ italic: !style.italic })}
		>
			<span class="fmt i">I</span>
		</button>
		<button
			type="button"
			class="fmt-btn"
			class:toggled={style.underline}
			aria-label="Underline"
			data-tip="Underline (Ctrl+U)"
			aria-pressed={style.underline}
			onclick={() => editor.applyStyle({ underline: !style.underline })}
		>
			<span class="fmt u">U</span>
		</button>

		<label class="fmt-btn color-btn" aria-label="Text color" data-tip="Text color">
			<span class="fmt">A</span>
			<span class="color-bar" style="background: {swatchColor};"></span>
			<input
				type="color"
				value={swatchColor}
				oninput={onTextColorInput}
				onchange={() => (liveTextColor = null)}
			/>
		</label>
	</div>

	<div class="separator"></div>

	<!-- Object -->
	<div class="group">
		<button
			type="button"
			class="icon-btn"
			class:toggled={editor.state.locked}
			aria-label={editor.state.locked ? 'Unlock canvas' : 'Lock canvas'}
			aria-pressed={editor.state.locked}
			onclick={editor.toggleLock}
		>
			{@render icon(editor.state.locked ? 'lock-closed' : 'lock-open')}
		</button>
		<button type="button" class="icon-btn" aria-label="Copy" onclick={editor.copy}>
			{@render icon('copy')}
		</button>
		<button type="button" class="icon-btn" aria-label="Delete" onclick={editor.deleteSelected}>
			{@render icon('delete')}
		</button>
	</div>
</div>

<style>
	.toolbar {
		flex: 0 0 46px;
		width: 100%;
		background: #ffffff;
		border-bottom: 1px solid #e3e0d6;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 12px;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
	}

	.group {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.separator {
		width: 1px;
		height: 22px;
		background: #e3e0d6;
		margin: 0 6px;
	}

	.icon-btn {
		position: relative;
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		color: #4a4c48;
		cursor: pointer;
		padding: 0;
		transition:
			background 0.12s ease,
			color 0.12s ease;
	}

	.icon-btn:hover:not(:disabled) {
		background: #efece6;
		color: #1f201d;
	}

	.icon-btn:disabled {
		opacity: 0.32;
		cursor: not-allowed;
	}

	.icon-btn.toggled {
		color: #a6192e;
		background: #fbeef0;
	}

	.icon-btn svg {
		width: 18px;
		height: 18px;
	}

	/* Tooltip on hover. Icon buttons read their text from aria-label; the
	   Bold / Italic / Underline buttons use data-tip so they can show their
	   keyboard shortcut without polluting the accessible label. */
	.icon-btn::after,
	.fmt-btn[data-tip]::after {
		position: absolute;
		top: calc(100% + 7px);
		left: 50%;
		transform: translateX(-50%);
		background: #373a36;
		color: #fff;
		/* Explicit font so every tooltip matches regardless of host element —
		   a <button> uses the UA control font while a <label> inherits the
		   toolbar font, which otherwise makes the text-color tooltip differ. */
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
	.icon-btn::after {
		content: attr(aria-label);
	}
	.fmt-btn[data-tip]::after {
		content: attr(data-tip);
	}

	.icon-btn:hover::after,
	.fmt-btn[data-tip]:hover::after {
		opacity: 1;
		transition-delay: 0.45s;
	}

	/* Dropdown triggers (zoom / font / size). */
	.tb-menu {
		position: relative;
	}

	.text-trigger {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 30px;
		padding: 0 8px;
		font-size: 0.82rem;
		color: #4a4c48;
		background: transparent;
		border: 1px solid #e3e0d6;
		border-radius: 6px;
		cursor: pointer;
		font-family: inherit;
		min-width: 64px;
		transition:
			border-color 0.12s ease,
			background 0.12s ease,
			color 0.12s ease;
	}

	.text-trigger.wide {
		min-width: 104px;
	}

	.text-trigger:hover {
		background: #efece6;
		color: #1f201d;
	}

	.text-trigger.active {
		border-color: #a6192e;
		color: #76232f;
		background: #fff;
	}

	.chev {
		display: inline-flex;
		width: 12px;
		height: 12px;
		color: #8a8b83;
	}
	.chev svg {
		width: 12px;
		height: 12px;
	}

	/* Editable number combo (zoom % / font size): a typed input + a chevron
	   button that opens the preset menu. Styled like .text-trigger so it sits
	   consistently in the toolbar; the whole box lights up on focus / when its
	   menu is open. */
	.num-combo {
		display: inline-flex;
		align-items: center;
		height: 30px;
		padding: 0 2px 0 8px;
		background: transparent;
		border: 1px solid #e3e0d6;
		border-radius: 6px;
		min-width: 64px;
		transition:
			border-color 0.12s ease,
			background 0.12s ease;
	}
	.num-combo.size-combo {
		min-width: 56px;
	}
	.num-combo:hover {
		background: #efece6;
	}
	.num-combo:focus-within,
	.num-combo.active {
		border-color: #a6192e;
		background: #fff;
	}

	.num-input {
		flex: 1;
		width: 0;
		min-width: 26px;
		border: none;
		background: transparent;
		font-family: inherit;
		font-size: 0.82rem;
		color: #4a4c48;
		padding: 0;
		text-align: right;
		outline: none;
		/* Hide the number spinners (only matters if type ever becomes number). */
		appearance: textfield;
		-moz-appearance: textfield;
	}
	.num-input::-webkit-outer-spin-button,
	.num-input::-webkit-inner-spin-button {
		appearance: none;
		margin: 0;
	}
	.num-combo:focus-within .num-input {
		color: #1f201d;
	}

	.num-suffix {
		font-size: 0.82rem;
		color: #8a8b83;
		margin: 0 1px 0 2px;
		pointer-events: none;
	}

	.num-chev {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 100%;
		padding: 0;
		background: transparent;
		border: none;
		color: #8a8b83;
		cursor: pointer;
	}
	.num-chev:hover {
		color: #4a4c48;
	}
	.num-chev svg {
		width: 12px;
		height: 12px;
	}

	.grow {
		flex: 1;
		text-align: left;
	}
	.ellipsis {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tabular {
		font-variant-numeric: tabular-nums;
	}

	/* Bold / Italic / Underline / Color buttons. */
	.fmt-btn {
		position: relative;
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		color: #4a4c48;
		cursor: pointer;
		padding: 0;
		transition:
			background 0.12s ease,
			color 0.12s ease;
	}

	.fmt-btn:hover {
		background: #efece6;
		color: #1f201d;
	}

	.fmt-btn.toggled {
		color: #a6192e;
		background: #fbeef0;
	}

	.fmt {
		font-size: 0.95rem;
		font-weight: 700;
		line-height: 1;
	}
	.fmt.i {
		font-style: italic;
		font-weight: 600;
		font-family: Georgia, serif;
	}
	.fmt.u {
		text-decoration: underline;
		font-weight: 600;
	}

	/* Text-color button: "A" with a colour bar under it + hidden native picker. */
	.color-btn {
		flex-direction: column;
		gap: 1px;
	}
	.color-btn .fmt {
		font-size: 0.9rem;
	}
	.color-bar {
		width: 16px;
		height: 3px;
		border-radius: 1px;
	}
	.color-btn input[type='color'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		width: 100%;
		height: 100%;
		cursor: pointer;
		border: none;
		padding: 0;
	}

	/* Shared dropdown panel. */
	.dropdown {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		min-width: 180px;
		background: #ffffff;
		border: 1px solid #ebe5d8;
		border-radius: 10px;
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.14);
		padding: 6px;
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: 1px;
		max-height: 320px;
		overflow-y: auto;
	}
	.dropdown.narrow {
		min-width: 120px;
	}

	.section-label {
		font-size: 0.66rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: #8a8b83;
		padding: 6px 12px 4px;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		border: none;
		color: #373a36;
		font-family: inherit;
		font-size: 0.86rem;
		padding: 7px 12px;
		text-align: left;
		cursor: pointer;
		border-radius: 6px;
		width: 100%;
		transition:
			background 0.1s ease,
			color 0.1s ease;
	}

	.menu-item:hover,
	.menu-item.checked {
		background: #fbeef0;
		color: #76232f;
	}

	.check {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #76232f;
	}
	.check svg {
		width: 14px;
		height: 14px;
	}

	.leading-icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #5a5c58;
	}
	.leading-icon svg {
		width: 15px;
		height: 15px;
	}

	.divider {
		height: 1px;
		background: #e8e5de;
		margin: 4px 4px;
	}
</style>
