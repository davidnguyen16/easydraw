<script lang="ts">
	/**
	 * Static mockup of the real EasyDraw editor for the landing hero — every
	 * region mirrors the actual components (MenuBar, ToolBar, Sidebar, entity
	 * cards, cardinality wires, EditorFooter) so the preview never oversells.
	 * Fixed 1020px wide; the wrapper scrolls horizontally on small screens.
	 * Approved design: claude artifact "hero-preview-design" v3.
	 */

	type Row = { chip?: 'PK' | 'FK'; text: string };

	const CARDS: { title: string; x: number; y: number; rows: Row[] }[] = [
		{ title: 'Users', x: 40, y: 34, rows: [{ chip: 'PK', text: 'id' }, { text: 'name' }, { text: 'email' }] },
		{ title: 'Orders', x: 640, y: 34, rows: [{ chip: 'PK', text: 'id' }, { chip: 'FK', text: 'user_id' }, { text: 'total' }] },
		{ title: 'Products', x: 40, y: 230, rows: [{ chip: 'PK', text: 'id' }, { text: 'name' }, { text: 'price' }] },
		{ title: 'Order_Items', x: 640, y: 230, rows: [{ chip: 'PK', text: 'id' }, { chip: 'FK', text: 'order_id' }, { chip: 'FK', text: 'product_id' }] }
	];

	const TOOL_ICON = 'flex size-[26px] flex-none items-center justify-center rounded-md';
	const SEP = 'mx-1.5 h-5 w-px flex-none bg-line-soft';
	const FONT_BOX =
		'inline-flex h-[26px] items-center gap-1.5 rounded-md border border-line-soft px-2 text-[11.5px]';
	const SEC =
		'flex items-center gap-1.5 text-[9.5px] font-bold tracking-[0.07em] text-mq-maroon';
	const TILE =
		'flex aspect-square items-center justify-center rounded-lg border border-[#e8e2d3] bg-white text-mq-red';
</script>

{#snippet chevron(open: boolean)}
	<svg
		width="9"
		height="9"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="3"
		stroke-linecap="round"
		stroke-linejoin="round"
		class={open ? 'rotate-90' : ''}
	>
		<polyline points="8 5 16 12 8 19" />
	</svg>
{/snippet}

<div class="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
	<div class="overflow-x-auto">
		<div
			class="mx-auto w-[1020px] overflow-hidden rounded-xl border border-line-soft bg-white
				font-sans shadow-2xl"
		>
			<!-- Window bar -->
			<div class="flex h-[34px] items-center gap-1.5 border-b border-[#e4e0d5] bg-[#f2f0ea] px-3.5">
				<span class="size-2.5 rounded-full bg-[#e8a49c]"></span>
				<span class="size-2.5 rounded-full bg-[#f2d491]"></span>
				<span class="size-2.5 rounded-full bg-[#a9d5a2]"></span>
				<span class="ml-2.5 text-[11px] text-ink-muted">EasyDraw Editor — Store Database</span>
			</div>

			<!-- MenuBar (real: maroon, logo, file name, status pill, menus, right cluster) -->
			<div class="flex h-[46px] items-center gap-[7px] bg-mq-maroon px-3 text-white">
				<span class="grid size-[26px] flex-none place-items-center rounded-[7px] bg-mq-red">
					<svg width="15" height="15" viewBox="0 0 48 48" fill="none">
						<rect x="8" y="8" width="14" height="10" rx="2.5" fill="#fff" opacity="0.95" />
						<rect x="26" y="30" width="14" height="10" rx="2.5" fill="#fff" opacity="0.95" />
						<path d="M22 13 L30 13 L30 30" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.8" fill="none" />
					</svg>
				</span>
				<span class="rounded-[5px] px-2 py-[3px] text-[13px] font-bold">Store Database</span>
				<span
					class="inline-flex h-5 items-center gap-[5px] rounded-full bg-black/[0.18] px-[9px]
						text-[10.5px] font-semibold text-white/[0.92]"
				>
					<span class="size-1.5 rounded-full bg-[#f97316]"></span>Draft
				</span>
				<nav class="ml-2 flex gap-0.5">
					<b class="rounded-[5px] bg-white/[0.12] px-2 py-1 text-[12.5px] font-normal text-white/85">File</b>
					{#each ['Edit', 'View', 'Arrange', 'Help'] as m (m)}
						<b class="rounded-[5px] px-2 py-1 text-[12.5px] font-normal text-white/85">{m}</b>
					{/each}
				</nav>
				<div class="ml-auto flex items-center gap-2">
					<!-- Cloud + check: the real saved-state indicator -->
					<span class="grid size-[26px] place-items-center rounded-[7px] text-white/[0.92]">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 15.3" /><path d="m8.5 13.5 2.5 2.5 4.5-4.5" /></svg>
					</span>
					<span
						class="grid size-[25px] flex-none place-items-center rounded-full bg-mq-red-hover
							text-[9.5px] font-bold tracking-[0.02em]"
					>
						MD
					</span>
					<span
						class="inline-flex h-[29px] items-center gap-1.5 rounded-lg bg-mq-red px-[13px]
							text-xs font-semibold"
					>
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5v14l11-7z" /></svg>
						Present
					</span>
					<span class="grid size-[26px] place-items-center rounded-[7px] text-white/[0.92]">
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
					</span>
				</div>
			</div>

			<!-- ToolBar — real order: File | History | Zoom | Text | Object -->
			<div class="flex h-[38px] items-center gap-0.5 border-b border-line-soft bg-white px-2.5 text-toolbar-text">
				<span class={TOOL_ICON}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" /></svg></span>
				<span class={TOOL_ICON}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7" /></svg></span>
				<span class={SEP}></span>
				<span class={TOOL_ICON}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h9a7 7 0 0 1 7 7v2" /></svg></span>
				<span class="{TOOL_ICON} opacity-40"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5" /><path d="M20 9h-9a7 7 0 0 0-7 7v2" /></svg></span>
				<span class={SEP}></span>
				<span class={TOOL_ICON}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M8 11h6" /></svg></span>
				<span class="{FONT_BOX} gap-[3px]">
					<span class="tabular-nums">100</span><span class="text-ink-muted">%</span>
					{@render smallChevron()}
				</span>
				<span class={TOOL_ICON}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M8 11h6M11 8v6" /></svg></span>
				<span class={TOOL_ICON}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg></span>
				<span class={SEP}></span>
				<span class={FONT_BOX}>Inter {@render smallChevron()}</span>
				<span class="{FONT_BOX} gap-[3px]">
					<span class="tabular-nums">14</span><span class="text-ink-muted">pt</span>
					{@render smallChevron()}
				</span>
				<span class="grid h-[26px] w-6 place-items-center text-xs font-bold">B</span>
				<span class="grid h-[26px] w-6 place-items-center text-xs italic">I</span>
				<span class="grid h-[26px] w-6 place-items-center text-xs underline">U</span>
				<span class={TOOL_ICON}>
					<span class="flex flex-col items-center leading-none">
						<b class="text-[11px] font-semibold">A</b>
						<span class="mt-px h-[3px] w-3 rounded-[1px] bg-mq-red"></span>
					</span>
				</span>
				<span class={SEP}></span>
				<span class={TOOL_ICON}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg></span>
				<span class={TOOL_ICON}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg></span>
			</div>

			<div class="flex">
				<!-- Sidebar — search box + sections in registry order -->
				<div class="w-[168px] flex-none border-r border-line-soft bg-panel px-3 pt-3 pb-3.5">
					<div
						class="mb-3 flex h-[27px] items-center gap-1.5 rounded-[7px] border border-line bg-white
							px-2 text-[10.5px] text-ink-muted"
					>
						<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg>
						Search shapes
					</div>

					<div class={SEC}>{@render chevron(true)} BASIC</div>
					<div class="mt-[7px] grid grid-cols-4 gap-1.5">
						<span class={TILE}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6" width="18" height="12" rx="1" /></svg></span>
						<span class={TILE}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="6" width="18" height="12" rx="5" /></svg></span>
						<span class={TILE}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="12" rx="9" ry="6.5" /></svg></span>
						<span class={TILE}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8" /></svg></span>
						<span class={TILE}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3l9 9-9 9-9-9z" /></svg></span>
						<span class={TILE}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M7 6h14l-4 12H3z" /></svg></span>
						<span class={TILE}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 4l9 16H3z" /></svg></span>
						<span class={TILE}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="7" width="18" height="10" rx="5" /></svg></span>
					</div>

					<div class="mt-[11px] {SEC}">{@render chevron(true)} UML</div>
					<div class="mt-[7px] grid grid-cols-4 gap-1.5">
						<span class={TILE}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="5" r="3" /><path d="M12 8v7M5.5 11h13M12 15l-4.5 6M12 15l4.5 6" /></svg></span>
					</div>

					<div class="mt-[11px] {SEC}">{@render chevron(true)} ENTITY RELATION</div>
					<div class="mt-[7px] grid grid-cols-4 gap-1.5">
						<span class={TILE}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="4" width="17" height="16" rx="1.5" /><path d="M3.5 9h17" /><path d="M6.5 13h8M6.5 16.5h5" /></svg></span>
						<span class={TILE}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3.5" width="18" height="17" rx="1.5" /><rect x="5.5" y="6" width="13" height="12" rx="1" /></svg></span>
						<span class={TILE}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 20.5h5.5Q9 20.5 9 19V6.5Q9 5 10.5 5h4" /><circle cx="16.3" cy="5" r="1.7" /><path d="M18 5h4M18.7 5l3.3-2.3M18.7 5l3.3 2.3" /></svg></span>
						<span class={TILE}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 12h20M16.5 12l4-2.6M16.5 12l4 2.6M6 9.4v5.2M8.5 9.4v5.2" /></svg></span>
					</div>

					<div class="mt-[11px] {SEC}">{@render chevron(false)} ARROWS</div>
					<div class="mt-[11px] {SEC}">{@render chevron(false)} FLOWCHART</div>
				</div>

				<!-- Canvas: dotted grid + entity cards + cardinality wires. Cards are
				     172×104 at (40,34)/(640,34)/(40,230)/(640,230): edges land on
				     x=212 / x=640 and y=138 / y=230, so every wire start and marker
				     tip touches a card edge. -->
				<div
					class="relative h-[372px] flex-1 bg-white
						bg-[radial-gradient(circle,#ddd9cd_1px,transparent_1px)] [background-size:16px_16px]"
				>
					<svg class="absolute inset-0 h-full w-full" viewBox="0 0 852 372" fill="none">
						<!-- Users 1──○< Orders -->
						<path d="M212 86 H640" stroke="#B4B2A9" stroke-width="1.5" />
						<path d="M226 78 v16 M232 78 v16" stroke="#B4B2A9" stroke-width="1.5" />
						<circle cx="606" cy="86" r="5" stroke="#B4B2A9" stroke-width="1.5" fill="#fff" />
						<path d="M618 86 L640 78 M618 86 L640 94" stroke="#B4B2A9" stroke-width="1.5" />
						<!-- Orders 1──< Order_Items (vertical) -->
						<path d="M726 138 V230" stroke="#B4B2A9" stroke-width="1.5" />
						<path d="M718 150 h16 M718 156 h16" stroke="#B4B2A9" stroke-width="1.5" />
						<path d="M726 208 L718 230 M726 208 L734 230" stroke="#B4B2A9" stroke-width="1.5" />
						<!-- Products 1──< Order_Items -->
						<path d="M212 282 H640" stroke="#B4B2A9" stroke-width="1.5" />
						<path d="M226 274 v16 M232 274 v16" stroke="#B4B2A9" stroke-width="1.5" />
						<path d="M618 282 L640 274 M618 282 L640 290" stroke="#B4B2A9" stroke-width="1.5" />
					</svg>
					<span
						class="absolute rounded-[3px] bg-white px-[7px] py-px text-[10px] font-semibold
							text-[#1f1d1a]"
						style="left: 392px; top: 275px;"
					>
						contains
					</span>

					{#each CARDS as card (card.title)}
						<div
							class="absolute h-[104px] w-[172px] rounded-md border border-[#cfcabd] bg-white
								text-[11px] shadow-[0_2px_10px_rgba(44,44,42,0.09)]"
							style="left: {card.x}px; top: {card.y}px;"
						>
							<div class="rounded-t-[5px] bg-mq-maroon px-2.5 py-1.5 text-xs font-semibold text-white">
								{card.title}
							</div>
							{#each card.rows as row, i (row.text)}
								<div
									class="flex items-center gap-1.5 px-2.5 py-[4.5px] text-[#373a36]
										{i > 0 ? 'border-t border-[#efede6]' : ''}"
								>
									{#if row.chip === 'PK'}
										<span class="flex-none rounded-[2px] bg-[#fae9c8] px-1 text-[8.5px] leading-[1.4] font-bold text-[#854f0b]">PK</span>
									{:else if row.chip === 'FK'}
										<span class="flex-none rounded-[2px] bg-[#dce9fa] px-1 text-[8.5px] leading-[1.4] font-bold text-[#1e4380]">FK</span>
									{/if}
									{row.text}
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>

			<!-- EditorFooter: hamburger · page tabs · + · shapes count -->
			<div class="flex h-[34px] items-stretch border-t border-[#e0e0e0] bg-[#fafafa] text-[11px]">
				<span class="grid w-[34px] place-items-center border-r border-[#e0e0e0] text-[#404040]">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
				</span>
				<span
					class="relative grid min-w-[96px] place-items-center border-r border-[#e0e0e0] bg-white
						font-medium text-[#2c2c2a] before:absolute before:top-0 before:right-0 before:left-0
						before:h-0.5 before:bg-mq-red before:content-['']"
				>
					Page 1
				</span>
				<span class="grid min-w-[96px] place-items-center border-r border-[#e0e0e0] font-medium text-[#2c2c2a]">
					Page 2
				</span>
				<span class="mx-1.5 grid w-[26px] place-items-center self-center text-[#6b6b6b]">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
				</span>
				<span class="ml-auto flex items-center gap-[5px] border-l border-[#e0e0e0] bg-white px-3">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a6192e" stroke-width="2" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></svg>
					<b class="font-semibold text-[#2c2c2a] tabular-nums">4</b>
					<span class="text-[#6b6b6b]">shapes</span>
				</span>
			</div>
		</div>
	</div>
</div>

{#snippet smallChevron()}
	<svg
		width="9"
		height="9"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.4"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<polyline points="6 9 12 15 18 9" />
	</svg>
{/snippet}
