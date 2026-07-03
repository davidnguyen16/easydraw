<script lang="ts">
	/**
	 * Style panel for a selected CONNECTION edge — the edge counterpart of
	 * StylePanel (which handles nodes). Shown by Flow.svelte when an edge is
	 * the active selection.
	 *
	 * Every control writes a patch into edge.data (via onDataChange), so the
	 * styling rides the existing persistence + undo/redo exactly like node
	 * styles do. ConnectionEdge reads the same fields back when rendering.
	 */
	import type { Edge } from '@xyflow/svelte';
	import { Trash2 } from '@lucide/svelte';
	import LineEndingsDialog from '$lib/components/LineEndingsDialog.svelte';
	import MarkerPreview from '$lib/components/MarkerPreview.svelte';
	import { MARKER_DEFS } from '$lib/flow/edges/connection/markers';
	import { markerPalette } from '$lib/stores/markers.store.svelte';
	import type {
		ConnectionEdgeData,
		EdgeLineStyle,
		EdgeRouting,
		MarkerKind
	} from '$lib/flow/edges/connection/types';

	interface Props {
		edge: Edge;
		onDataChange: (patch: Record<string, unknown>) => void;
		onDelete: () => void;
	}

	let { edge, onDataChange, onDelete }: Props = $props();

	const data = $derived((edge.data ?? {}) as ConnectionEdgeData);
	const markerStart = $derived<MarkerKind>(data.markerStart ?? 'none');
	const markerEnd = $derived<MarkerKind>(data.markerEnd ?? 'none');
	const lineStyle = $derived<EdgeLineStyle>(data.lineStyle ?? 'solid');
	const routing = $derived<EdgeRouting>(data.routing ?? 'orthogonal');
	const strokeWidth = $derived(data.strokeWidth ?? 1.5);

	// The default line grey doubles as the first palette swatch, so a pristine
	// edge shows it ringed as "current" (keep in sync with ConnectionEdge's
	// COLOR_DEFAULT).
	const DEFAULT_COLOR = '#B4B2A9';
	const strokeColor = $derived((data.strokeColor ?? DEFAULT_COLOR).toUpperCase());

	// Markers offered in the Start/End dropdowns: the catalog filtered by the
	// user's Line endings selection ("None" is pinned in the menu separately).
	const enabledMarkers = $derived(
		MARKER_DEFS.filter((d) => markerPalette.enabled.includes(d.id))
	);

	// "Line endings" dialog (More button at the bottom of either dropdown).
	let moreOpen = $state(false);

	function openMore() {
		openMenu = null;
		moreOpen = true;
	}

	const LINE_STYLES: { id: EdgeLineStyle; label: string }[] = [
		{ id: 'solid', label: 'Solid' },
		{ id: 'dashed', label: 'Dashed' },
		{ id: 'dotted', label: 'Dotted' }
	];

	const ROUTINGS: { id: EdgeRouting; label: string }[] = [
		{ id: 'straight', label: 'Straight' },
		{ id: 'orthogonal', label: 'Orthogonal' },
		{ id: 'curved', label: 'Curved' }
	];

	const SWATCHES = ['#B4B2A9', '#2C2C2A', '#A6192E', '#1F4E9C', '#0F7B5F'];

	const WIDTH_MIN = 0.5;
	const WIDTH_MAX = 10;

	function adjustWidth(delta: number) {
		const next = Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, strokeWidth + delta));
		onDataChange({ strokeWidth: next });
	}

	// ─── Dropdown menus (Start / End / Line style) ──────────────────────
	// Same technique as StylePanel's font menu: the panel clips overflow, so
	// menus render position:fixed with coordinates computed from the trigger.
	type MenuId = 'start' | 'end' | 'line';
	let openMenu = $state<MenuId | null>(null);
	let menuStyle = $state('');
	let menuEl = $state<HTMLDivElement>();

	function toggleMenu(which: MenuId, e: MouseEvent) {
		if (openMenu === which) {
			openMenu = null;
			return;
		}
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		menuStyle = [
			`left: ${rect.left}px`,
			`top: ${rect.bottom + 4}px`,
			`min-width: ${rect.width}px`,
			`max-height: 300px`
		].join('; ');
		openMenu = which;
	}

	function pickMarker(end: 'start' | 'end', kind: MarkerKind) {
		onDataChange(end === 'start' ? { markerStart: kind } : { markerEnd: kind });
		openMenu = null;
	}

	function pickLineStyle(styleId: EdgeLineStyle) {
		onDataChange({ lineStyle: styleId });
		openMenu = null;
	}

	// While a menu is open: close on outside click, Escape, or scroll outside
	// the menu (a fixed menu would detach from its trigger otherwise).
	$effect(() => {
		if (!openMenu) return;
		const onPointerDown = (e: PointerEvent) => {
			if (e.target instanceof Element) {
				if (menuEl?.contains(e.target) || e.target.closest('.dd-trigger')) return;
			}
			openMenu = null;
		};
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') openMenu = null;
		};
		const onScroll = (e: Event) => {
			if (menuEl && e.target instanceof Node && menuEl.contains(e.target)) return;
			openMenu = null;
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

{#snippet linePreview(styleId: EdgeLineStyle)}
	<svg viewBox="0 0 44 12" width="44" height="12" aria-hidden="true">
		<line
			x1="2"
			y1="6"
			x2="42"
			y2="6"
			stroke="#2c2c2a"
			stroke-width="1.6"
			stroke-linecap="round"
			stroke-dasharray={styleId === 'dashed' ? '7 5' : styleId === 'dotted' ? '0.1 5' : undefined}
		/>
	</svg>
{/snippet}

{#snippet chevron()}
	<svg
		viewBox="0 0 24 24"
		width="12"
		height="12"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<polyline points="6 9 12 15 18 9" />
	</svg>
{/snippet}

{#snippet routingIcon(id: EdgeRouting)}
	<svg
		viewBox="0 0 22 22"
		width="22"
		height="22"
		fill="none"
		stroke="currentColor"
		stroke-width="1.7"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if id === 'straight'}
			<circle cx="4.5" cy="17.5" r="2" fill="currentColor" stroke="none" />
			<line x1="6" y1="16" x2="16" y2="6" />
			<circle cx="17.5" cy="4.5" r="2" fill="currentColor" stroke="none" />
		{:else if id === 'orthogonal'}
			<path d="M4,19 L4,13 L10,13 L10,8 L16,8 L16,3" />
		{:else}
			<circle cx="4.5" cy="17.5" r="2" fill="currentColor" stroke="none" />
			<path d="M6,16 C10,12 10,7 16,5.5" />
			<circle cx="17.5" cy="4.5" r="2" fill="currentColor" stroke="none" />
		{/if}
	</svg>
{/snippet}

<aside class="conn-panel" aria-label="Connection style">
	<header class="panel-head">
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<circle cx="3" cy="13" r="1.8" fill="currentColor" stroke="none" />
			<path d="M4.5,11.5 C7,9 9,7 11.5,4.5" />
			<circle cx="13" cy="3" r="1.8" fill="currentColor" stroke="none" />
		</svg>
		<h2>Connection</h2>
	</header>

	<div class="content">
		<section class="group">
			<h3 class="group-label">ENDPOINTS</h3>
			<div class="grid-2">
				<div class="field">
					<span class="field-label">Start</span>
					<button
						type="button"
						class="dd-trigger"
						aria-haspopup="listbox"
						aria-expanded={openMenu === 'start'}
						aria-label="Start endpoint"
						onclick={(e) => toggleMenu('start', e)}
					>
						<MarkerPreview kind={markerStart} end="start" />
						<span class="chev">{@render chevron()}</span>
					</button>
				</div>
				<div class="field">
					<span class="field-label">End</span>
					<button
						type="button"
						class="dd-trigger"
						aria-haspopup="listbox"
						aria-expanded={openMenu === 'end'}
						aria-label="End endpoint"
						onclick={(e) => toggleMenu('end', e)}
					>
						<MarkerPreview kind={markerEnd} end="end" />
						<span class="chev">{@render chevron()}</span>
					</button>
				</div>
			</div>
		</section>

		<section class="group">
			<h3 class="group-label">LINE STYLE</h3>
			<button
				type="button"
				class="dd-trigger"
				aria-haspopup="listbox"
				aria-expanded={openMenu === 'line'}
				aria-label="Line style"
				onclick={(e) => toggleMenu('line', e)}
			>
				{@render linePreview(lineStyle)}
				<span class="dd-text">{LINE_STYLES.find((s) => s.id === lineStyle)?.label}</span>
				<span class="chev">{@render chevron()}</span>
			</button>
		</section>

		<section class="group">
			<h3 class="group-label">ROUTING</h3>
			<div class="routing-row">
				{#each ROUTINGS as r (r.id)}
					<button
						type="button"
						class="routing-btn"
						class:active={routing === r.id}
						aria-pressed={routing === r.id}
						aria-label="{r.label} routing"
						title={r.label}
						onclick={() => onDataChange({ routing: r.id })}
					>
						{@render routingIcon(r.id)}
					</button>
				{/each}
			</div>
		</section>

		<section class="group">
			<h3 class="group-label">LINE WIDTH</h3>
			<div class="width-row">
				<button type="button" aria-label="Decrease line width" onclick={() => adjustWidth(-0.5)}
					>−</button
				>
				<div class="width-value">{strokeWidth} px</div>
				<button type="button" aria-label="Increase line width" onclick={() => adjustWidth(0.5)}
					>+</button
				>
			</div>
		</section>

		<section class="group">
			<h3 class="group-label">COLOR</h3>
			<div class="color-row">
				{#each SWATCHES as c (c)}
					<button
						type="button"
						class="swatch"
						class:selected={strokeColor === c}
						style="background-color: {c};"
						aria-label="Line colour {c}"
						onclick={() => onDataChange({ strokeColor: c })}
					></button>
				{/each}
				<label
					class="swatch rainbow"
					class:selected={!SWATCHES.includes(strokeColor)}
					aria-label="Custom line colour"
				>
					<input
						type="color"
						value={strokeColor}
						oninput={(e) => onDataChange({ strokeColor: e.currentTarget.value.toUpperCase() })}
					/>
				</label>
			</div>
		</section>

		<button type="button" class="delete-btn" onclick={onDelete}>
			<Trash2 size={15} />
			Delete connection
		</button>
	</div>
</aside>

{#if openMenu === 'start' || openMenu === 'end'}
	{@const end = openMenu}
	{@const current = end === 'start' ? markerStart : markerEnd}
	<div class="dd-menu" role="listbox" aria-label="Endpoint markers" bind:this={menuEl} style={menuStyle}>
		<button
			type="button"
			role="option"
			aria-selected={current === 'none'}
			class="dd-option label-option"
			class:checked={current === 'none'}
			onclick={() => pickMarker(end, 'none')}
		>
			None
		</button>
		{#each enabledMarkers as m (m.id)}
			<button
				type="button"
				role="option"
				aria-selected={m.id === current}
				class="dd-option"
				class:checked={m.id === current}
				title={m.label}
				aria-label={m.label}
				onclick={() => pickMarker(end, m.id)}
			>
				<MarkerPreview kind={m.id} {end} width={64} />
			</button>
		{/each}
		<button type="button" class="dd-option label-option more" onclick={openMore}>More</button>
	</div>
{:else if openMenu === 'line'}
	<div class="dd-menu" role="listbox" aria-label="Line styles" bind:this={menuEl} style={menuStyle}>
		{#each LINE_STYLES as s (s.id)}
			<button
				type="button"
				role="option"
				aria-selected={s.id === lineStyle}
				class="dd-option"
				class:checked={s.id === lineStyle}
				onclick={() => pickLineStyle(s.id)}
			>
				{@render linePreview(s.id)}
				<span>{s.label}</span>
			</button>
		{/each}
	</div>
{/if}

{#if moreOpen}
	<LineEndingsDialog onClose={() => (moreOpen = false)} />
{/if}

<style>
	/* Mirrors StylePanel's shell so node + connection panels read as one UI. */
	.conn-panel {
		position: absolute;
		top: 16px;
		right: 16px;
		width: 280px;
		background: #f5f3ef;
		border: 1px solid #d6d2c4;
		border-radius: 12px;
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

	.panel-head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 18px;
		border-bottom: 1px solid #d6d2c4;
		color: #373a36;
		flex-shrink: 0;
	}

	.panel-head h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
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

	.grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 0.78rem;
		color: #6f7068;
	}

	.dd-trigger {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 8px;
		padding: 9px 10px;
		cursor: pointer;
		color: #373a36;
		font-family: inherit;
		font-size: 0.85rem;
	}

	.dd-trigger:hover {
		border-color: #c4c1b8;
	}

	.dd-trigger:focus-visible {
		outline: none;
		border-color: #a6192e;
	}

	.dd-trigger .dd-text {
		flex: 1;
		text-align: left;
	}

	.dd-trigger .chev {
		margin-left: auto;
		display: inline-flex;
		color: #8a8b83;
		flex-shrink: 0;
	}

	/* Escapes .conn-panel's overflow via position:fixed (coords from trigger). */
	.dd-menu {
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

	.dd-option {
		display: flex;
		align-items: center;
		gap: 10px;
		background: transparent;
		border: none;
		border-radius: 6px;
		padding: 7px 10px;
		font-family: inherit;
		font-size: 0.85rem;
		color: #373a36;
		text-align: left;
		cursor: pointer;
		white-space: nowrap;
	}

	.dd-option:hover {
		background: #f3f1ea;
	}

	.dd-option.checked {
		background: #f7e9ea;
	}

	/* "None" (pinned first) and "More" (pinned last) rows: centred text with a
	   separator toward the marker previews between them. */
	.dd-option.label-option {
		justify-content: center;
		border-bottom: 1px solid #eae7dd;
		border-radius: 0;
		margin: 0 -6px;
		padding: 8px 10px;
	}

	.dd-option.label-option.more {
		border-bottom: none;
		border-top: 1px solid #eae7dd;
		color: #5f5e5a;
	}

	.routing-row {
		display: flex;
		gap: 10px;
	}

	.routing-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 8px;
		padding: 10px 0;
		cursor: pointer;
		color: #5f5e5a;
		transition:
			border-color 0.12s ease,
			background 0.12s ease,
			color 0.12s ease;
	}

	.routing-btn:hover {
		border-color: #c4c1b8;
	}

	.routing-btn.active {
		border-color: #a6192e;
		background: #f7e3e4;
		color: #a6192e;
	}

	.width-row {
		display: flex;
		align-items: stretch;
		gap: 10px;
	}

	.width-row button {
		width: 40px;
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 8px;
		cursor: pointer;
		color: #373a36;
		font-size: 1rem;
		line-height: 1;
		font-family: inherit;
	}

	.width-row button:hover {
		border-color: #c4c1b8;
		background: #faf9f6;
	}

	.width-value {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 8px;
		padding: 10px 0;
		font-size: 0.88rem;
		color: #373a36;
		font-variant-numeric: tabular-nums;
	}

	.color-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.swatch {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
	}

	.swatch.selected {
		box-shadow:
			0 0 0 2px #f5f3ef,
			0 0 0 4px #76232f;
	}

	/* Custom colour: a rainbow wheel wrapping the native picker. */
	.swatch.rainbow {
		position: relative;
		display: inline-block;
		background: conic-gradient(
			#ff4d4d,
			#ffb14d,
			#f5e04d,
			#5ad45a,
			#4dc3ff,
			#6a5cff,
			#e14dff,
			#ff4d4d
		);
	}

	.swatch.rainbow input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
		border: none;
		padding: 0;
	}

	.delete-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 8px;
		padding: 12px 0;
		font-family: inherit;
		font-size: 0.88rem;
		color: #a6192e;
		cursor: pointer;
		transition:
			background 0.12s ease,
			border-color 0.12s ease;
	}

	.delete-btn:hover {
		background: #fdf2f1;
		border-color: #a6192e;
	}
</style>
