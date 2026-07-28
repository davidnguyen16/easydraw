<script lang="ts">
	import {
		FLOATING_STYLE_PANEL_RIGHT_GAP_PX,
		FLOATING_STYLE_PANEL_WIDTH_PX
	} from '$lib/components/style-panel/layout';
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
	import { Trash2, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import LineEndingsDialog from '$lib/components/LineEndingsDialog.svelte';
	import MarkerPreview from '$lib/components/MarkerPreview.svelte';
	import ColorField from '$lib/components/ColorField.svelte';
	import { MARKER_DEFS } from '$lib/flow/edges/markers';
	import { markerPalette } from '$lib/stores/markers.store.svelte';
	import type {
		ConnectionEdgeData,
		EdgeLineStyle,
		EdgeRouting,
		MarkerKind
	} from '$lib/flow/edges/types';

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

	// COLOR palette pages (draw.io-style ◀ ▶ pager), mirroring the node panel's
	// FILL swatches. Page 0 is the line defaults the panel opens on — grey leads
	// because it's the actual default stroke (keep in sync with DEFAULT_COLOR /
	// ConnectionEdge's COLOR_DEFAULT). The rest are the same classic colours the
	// FILL palette offers; six per page.
	const COLOR_PAGES: string[][] = [
		['#B4B2A9', '#2C2C2A', '#A6192E', '#1F4E9C', '#0F7B5F', '#6B4DBA'], // defaults (grey leads)
		['#E53935', '#FF6347', '#FF7F0E', '#FB8C00', '#FFC107', '#FFD700'], // reds & oranges
		['#FFEB3B', '#CDDC39', '#8BC34A', '#4CAF50', '#2E7D32', '#009688'], // yellows & greens
		['#00BCD4', '#4FC3F7', '#2196F3', '#1F77B4', '#1A237E', '#3F51B5'], // cyans & blues
		['#673AB7', '#9C27B0', '#E91E63', '#795548', '#9E9E9E', '#2C2C2A'] // purples, pink & neutrals
	];
	const LAST_COLOR_PAGE = COLOR_PAGES.length - 1;

	// Which palette page is showing. Component-local $state → resets to 0 whenever
	// this panel (re)mounts (toggling the style panel off/on unmounts it), so
	// reopening always lands on the default page.
	let colorPage = $state(0);
	const colorSwatches = $derived(COLOR_PAGES[colorPage]);

	// Arrow buttons flanking the swatch row; stretch to the swatch height (row is
	// items-stretch), dimmed at the ends.
	const COLOR_ARROW = [
		'flex w-6 flex-shrink-0 cursor-pointer items-center justify-center rounded border-none',
		'bg-transparent text-ink-muted transition-colors duration-[120ms]',
		'hover:bg-surface-hover hover:text-mq-maroon',
		'disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted'
	].join(' ');

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

<aside
	class="absolute top-4 z-50 flex max-h-[calc(100%-32px)] flex-col
		overflow-hidden rounded-xl border border-line bg-panel font-sans
		shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
	style:right={`${FLOATING_STYLE_PANEL_RIGHT_GAP_PX}px`}
	style:width={`${FLOATING_STYLE_PANEL_WIDTH_PX}px`}
	aria-label="Connection style"
>
	<header class="flex flex-shrink-0 items-center gap-2 border-b border-line px-[18px] py-[14px] text-ink-soft">
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
		<h2 class="m-0 text-[0.95rem] font-semibold">Connection</h2>
	</header>

	<div class="flex flex-col gap-5 overflow-y-auto p-[18px]">
		<section class="flex flex-col gap-2.5">
			<h3 class="m-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">ENDPOINTS</h3>
			<div class="grid grid-cols-2 gap-2.5">
				<div class="flex flex-col gap-1.5">
					<span class="text-[0.78rem] text-[#6f7068]">Start</span>
					<button
						type="button"
						class="dd-trigger flex w-full cursor-pointer items-center gap-2 rounded-lg border
							border-line bg-white px-2.5 py-[9px] text-[0.85rem] text-ink-soft
							hover:border-[#c4c1b8] focus-visible:border-mq-red focus-visible:outline-none"
						aria-haspopup="listbox"
						aria-expanded={openMenu === 'start'}
						aria-label="Start endpoint"
						onclick={(e) => toggleMenu('start', e)}
					>
						<MarkerPreview kind={markerStart} end="start" />
						<span class="ml-auto inline-flex flex-shrink-0 text-ink-muted">{@render chevron()}</span>
					</button>
				</div>
				<div class="flex flex-col gap-1.5">
					<span class="text-[0.78rem] text-[#6f7068]">End</span>
					<button
						type="button"
						class="dd-trigger flex w-full cursor-pointer items-center gap-2 rounded-lg border
							border-line bg-white px-2.5 py-[9px] text-[0.85rem] text-ink-soft
							hover:border-[#c4c1b8] focus-visible:border-mq-red focus-visible:outline-none"
						aria-haspopup="listbox"
						aria-expanded={openMenu === 'end'}
						aria-label="End endpoint"
						onclick={(e) => toggleMenu('end', e)}
					>
						<MarkerPreview kind={markerEnd} end="end" />
						<span class="ml-auto inline-flex flex-shrink-0 text-ink-muted">{@render chevron()}</span>
					</button>
				</div>
			</div>
		</section>

		<section class="flex flex-col gap-2.5">
			<h3 class="m-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">LINE STYLE</h3>
			<button
				type="button"
				class="dd-trigger flex w-full cursor-pointer items-center gap-2 rounded-lg border
					border-line bg-white px-2.5 py-[9px] text-[0.85rem] text-ink-soft hover:border-[#c4c1b8]
					focus-visible:border-mq-red focus-visible:outline-none"
				aria-haspopup="listbox"
				aria-expanded={openMenu === 'line'}
				aria-label="Line style"
				onclick={(e) => toggleMenu('line', e)}
			>
				{@render linePreview(lineStyle)}
				<span class="flex-1 text-left">{LINE_STYLES.find((s) => s.id === lineStyle)?.label}</span>
				<span class="ml-auto inline-flex flex-shrink-0 text-ink-muted">{@render chevron()}</span>
			</button>
		</section>

		<section class="flex flex-col gap-2.5">
			<h3 class="m-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">ROUTING</h3>
			<div class="flex gap-2.5">
				{#each ROUTINGS as r (r.id)}
					<button
						type="button"
						class="flex flex-1 cursor-pointer items-center justify-center rounded-lg border py-2.5
							transition-colors duration-[120ms] {routing === r.id
							? 'border-mq-red bg-[#f7e3e4] text-mq-red'
							: 'border-line bg-white text-[#5f5e5a] hover:border-[#c4c1b8]'}"
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

		<section class="flex flex-col gap-2.5">
			<h3 class="m-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">LINE WIDTH</h3>
			<div class="flex items-stretch gap-2.5">
				<button
					type="button"
					class="w-10 cursor-pointer rounded-lg border border-line bg-white text-base leading-none
						text-ink-soft hover:border-[#c4c1b8] hover:bg-[#faf9f6]"
					aria-label="Decrease line width"
					onclick={() => adjustWidth(-0.5)}>−</button
				>
				<div
					class="flex flex-1 items-center justify-center rounded-lg border border-line bg-white py-2.5
						text-[0.88rem] tabular-nums text-ink-soft"
				>
					{strokeWidth} px
				</div>
				<button
					type="button"
					class="w-10 cursor-pointer rounded-lg border border-line bg-white text-base leading-none
						text-ink-soft hover:border-[#c4c1b8] hover:bg-[#faf9f6]"
					aria-label="Increase line width"
					onclick={() => adjustWidth(0.5)}>+</button
				>
			</div>
		</section>

		<section class="flex flex-col gap-2.5">
			<h3 class="m-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">COLOR</h3>
			<div class="flex items-stretch gap-1">
				<button
					type="button"
					class={COLOR_ARROW}
					aria-label="Previous colours"
					disabled={colorPage === 0}
					onclick={() => (colorPage = Math.max(0, colorPage - 1))}
				>
					<ChevronLeft size={18} />
				</button>
				<div class="grid flex-1 grid-cols-6 gap-1.5">
					{#each colorSwatches as c (c)}
						<button
							type="button"
							class="aspect-square w-full cursor-pointer rounded-full border-none p-0
								transition-[transform,box-shadow] duration-100 hover:-translate-y-px {strokeColor === c
								? 'shadow-[0_0_0_2px_#f5f3ef,0_0_0_4px_#76232f]'
								: ''}"
							style="background-color: {c};"
							aria-label="Line colour {c}"
							onclick={() => onDataChange({ strokeColor: c })}
						></button>
					{/each}
				</div>
				<button
					type="button"
					class={COLOR_ARROW}
					aria-label="More colours"
					disabled={colorPage === LAST_COLOR_PAGE}
					onclick={() => (colorPage = Math.min(LAST_COLOR_PAGE, colorPage + 1))}
				>
					<ChevronRight size={18} />
				</button>
			</div>
			<div class="flex items-center justify-between gap-2">
				<span class="text-[0.85rem] text-ink-soft">Custom</span>
				<ColorField
					value={strokeColor}
					label="Line"
					onChange={(hex) => onDataChange({ strokeColor: hex })}
				/>
			</div>
		</section>

		<button
			type="button"
			class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border
				border-line bg-white py-3 text-[0.88rem] text-mq-red transition-colors duration-[120ms]
				hover:border-mq-red hover:bg-[#fdf2f1]"
			onclick={onDelete}
		>
			<Trash2 size={15} />
			Delete connection
		</button>
	</div>
</aside>

{#if openMenu === 'start' || openMenu === 'end'}
	{@const end = openMenu}
	{@const current = end === 'start' ? markerStart : markerEnd}
	<div
		class="fixed z-[120] flex flex-col gap-0.5 overflow-y-auto rounded-lg border border-line
			bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
		role="listbox"
		aria-label="Endpoint markers"
		bind:this={menuEl}
		style={menuStyle}
	>
		<button
			type="button"
			role="option"
			aria-selected={current === 'none'}
			class="-mx-1.5 flex cursor-pointer items-center justify-center gap-2.5 border-b
				border-[#eae7dd] bg-transparent px-2.5 py-2 text-[0.85rem] whitespace-nowrap text-ink-soft
				{current === 'none' ? 'bg-[#f7e9ea]' : 'hover:bg-[#f3f1ea]'}"
			onclick={() => pickMarker(end, 'none')}
		>
			None
		</button>
		{#each enabledMarkers as m (m.id)}
			<button
				type="button"
				role="option"
				aria-selected={m.id === current}
				class="flex cursor-pointer items-center gap-2.5 rounded-md border-none bg-transparent px-2.5
					py-[7px] text-left text-[0.85rem] whitespace-nowrap text-ink-soft
					{m.id === current ? 'bg-[#f7e9ea]' : 'hover:bg-[#f3f1ea]'}"
				title={m.label}
				aria-label={m.label}
				onclick={() => pickMarker(end, m.id)}
			>
				<MarkerPreview kind={m.id} {end} width={64} />
			</button>
		{/each}
		<button
			type="button"
			class="-mx-1.5 flex cursor-pointer items-center justify-center gap-2.5 border-t border-[#eae7dd]
				bg-transparent px-2.5 py-2 text-[0.85rem] whitespace-nowrap text-[#5f5e5a] hover:bg-[#f3f1ea]"
			onclick={openMore}>More</button
		>
	</div>
{:else if openMenu === 'line'}
	<div
		class="fixed z-[120] flex flex-col gap-0.5 overflow-y-auto rounded-lg border border-line
			bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
		role="listbox"
		aria-label="Line styles"
		bind:this={menuEl}
		style={menuStyle}
	>
		{#each LINE_STYLES as s (s.id)}
			<button
				type="button"
				role="option"
				aria-selected={s.id === lineStyle}
				class="flex cursor-pointer items-center gap-2.5 rounded-md border-none bg-transparent px-2.5
					py-[7px] text-left text-[0.85rem] whitespace-nowrap text-ink-soft
					{s.id === lineStyle ? 'bg-[#f7e9ea]' : 'hover:bg-[#f3f1ea]'}"
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
