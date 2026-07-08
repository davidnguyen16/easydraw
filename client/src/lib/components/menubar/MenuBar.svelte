<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { editorMetaData } from '$lib/stores/editor.store.svelte';
	import type { Exporter } from '$lib/exporters';

	interface MenuItem {
		type?: 'divider';
		icon?: string;
		label?: string;
		shortcut?: string;
		disabled?: boolean;
		danger?: boolean;
		toggle?: boolean;
		checked?: boolean;
		submenu?: MenuItem[];
		onClick?: () => void;
	}

	interface EditorContext {
		state: { zoomPercent: number; showGrid: boolean; snapToGrid: boolean };
		history: { canUndo: boolean; canRedo: boolean };
		save: () => void;
		newFile: () => void;
		open: () => void;
		saveAs: () => void;
		exportFormats: readonly Exporter[];
		exportAs: (formatId: string) => void;
		undo: () => void;
		redo: () => void;
		cut: () => void;
		copy: () => void;
		paste: () => void;
		zoomIn: () => void;
		zoomOut: () => void;
		fitView: () => void;
		duplicate: () => void;
		deleteSelected: () => void;
		selectAll: () => void;
		bringToFront: () => void;
		sendToBack: () => void;
		group: () => void;
		ungroup: () => void;
		toggleShowGrid: () => void;
		toggleSnapToGrid: () => void;
		share: () => void;
	}

	const editor = getContext<EditorContext>('editor');

	const USER_INITIALS = 'MD';

	let openMenu: string | null = $state(null);
	let openSubmenu: string | null = $state(null);

	function toggleMenu(label: string) {
		openMenu = openMenu === label ? null : label;
		openSubmenu = null;
	}

	function closeMenus() {
		openMenu = null;
		openSubmenu = null;
	}

	function runItem(item: MenuItem) {
		if (item.disabled) return;
		if (item.submenu) {
			openSubmenu = openSubmenu === item.label ? null : (item.label ?? null);
			return;
		}
		if (!item.onClick) return;
		item.onClick();
		closeMenus();
	}

	// Outside click + Escape close any open dropdown / submenu.
	onMount(() => {
		const onPointer = (event: PointerEvent) => {
			const target = event.target as HTMLElement | null;
			// `data-menu-root` marks the <nav> that holds the triggers + dropdowns
			// (a DOM hook that survives the Tailwind migration — don't key this on
			// a styling class, those get renamed).
			if (target?.closest('[data-menu-root]')) return;
			closeMenus();
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeMenus();
		};
		window.addEventListener('pointerdown', onPointer);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('pointerdown', onPointer);
			window.removeEventListener('keydown', onKey);
		};
	});

	// Export submenu built off the registry so new formats appear automatically.
	// Format label gets its extension appended in parens (e.g. "XML (.easydraw)").
	const exportSubmenu: MenuItem[] = $derived(
		editor.exportFormats.map((format) => ({
			label: `${format.label} (${format.extension})`,
			onClick: () => editor.exportAs(format.id)
		}))
	);

	// Menus rebuild each render so disabled/checked state stays in sync with state/history.
	const menus = $derived<Record<string, MenuItem[]>>({
		File: [
			{ icon: 'new', label: 'New', shortcut: 'Ctrl+N', onClick: editor.newFile },
			{ icon: 'open', label: 'Open…', shortcut: 'Ctrl+O', onClick: editor.open },
			{ icon: 'save', label: 'Save', shortcut: 'Ctrl+S', onClick: editor.save },
			{ icon: 'save', label: 'Save As…', shortcut: 'Ctrl+Shift+S', onClick: editor.saveAs },
			{ type: 'divider' },
			{ icon: 'export', label: 'Export as', submenu: exportSubmenu }
		],
		Edit: [
			{
				icon: 'undo',
				label: 'Undo',
				shortcut: 'Ctrl+Z',
				onClick: editor.undo,
				disabled: !editor.history.canUndo
			},
			{
				icon: 'redo',
				label: 'Redo',
				shortcut: 'Ctrl+Y',
				onClick: editor.redo,
				disabled: !editor.history.canRedo
			},
			{ type: 'divider' },
			{ icon: 'cut', label: 'Cut', shortcut: 'Ctrl+X', onClick: editor.cut },
			{ icon: 'copy', label: 'Copy', shortcut: 'Ctrl+C', onClick: editor.copy },
			{ icon: 'paste', label: 'Paste', shortcut: 'Ctrl+V', onClick: editor.paste },
			{
				icon: 'duplicate',
				label: 'Duplicate',
				shortcut: 'Ctrl+D',
				onClick: editor.duplicate
			},
			{ type: 'divider' },
			{
				icon: 'select-all',
				label: 'Select all',
				shortcut: 'Ctrl+A',
				onClick: editor.selectAll
			},
			{ type: 'divider' },
			{
				icon: 'delete',
				label: 'Delete',
				shortcut: 'Del',
				onClick: editor.deleteSelected,
				danger: true
			}
		],
		View: [
			{
				toggle: true,
				label: 'Show grid',
				checked: editor.state.showGrid,
				onClick: editor.toggleShowGrid
			},
			{
				toggle: true,
				label: 'Snap to grid',
				checked: editor.state.snapToGrid,
				onClick: editor.toggleSnapToGrid
			},
			{ type: 'divider' },
			{ icon: 'zoom-in', label: 'Zoom in', shortcut: 'Ctrl+=', onClick: editor.zoomIn },
			{ icon: 'zoom-out', label: 'Zoom out', shortcut: 'Ctrl+-', onClick: editor.zoomOut },
			{
				icon: 'fit',
				label: 'Fit to screen',
				shortcut: 'Ctrl+Shift+H',
				onClick: editor.fitView
			}
		],
		Arrange: [
			{
				icon: 'bring-front',
				label: 'Bring to front',
				shortcut: 'Ctrl+Shift+F',
				onClick: editor.bringToFront
			},
			{
				icon: 'send-back',
				label: 'Send to back',
				shortcut: 'Ctrl+Shift+B',
				onClick: editor.sendToBack
			},
			{ type: 'divider' },
			{ icon: 'group', label: 'Group', shortcut: 'Ctrl+G', onClick: editor.group },
			{ icon: 'ungroup', label: 'Ungroup', shortcut: 'Ctrl+Shift+G', onClick: editor.ungroup }
		],
		Help: [
			{
				icon: 'info',
				label: 'About EasyDraw',
				onClick: () => alert('EasyDraw — a free diagram editor.')
			},
			{
				icon: 'keyboard',
				label: 'Keyboard shortcuts',
				onClick: () =>
					alert(
						'Save: Ctrl+S\nSave As: Ctrl+Shift+S\nOpen: Ctrl+O\nNew: Ctrl+N\nUndo: Ctrl+Z\nRedo: Ctrl+Y\nCut: Ctrl+X\nCopy: Ctrl+C\nPaste: Ctrl+V\nDuplicate: Ctrl+D\nSelect All: Ctrl+A\nDelete: Del\nGroup: Ctrl+G\nUngroup: Ctrl+Shift+G\nBring to Front: Ctrl+Shift+F\nSend to Back: Ctrl+Shift+B\nZoom In: Ctrl+=\nZoom Out: Ctrl+-\nFit to Screen: Ctrl+Shift+H'
					)
			}
		]
	});

	const menuLabels = ['File', 'Edit', 'View', 'Arrange', 'Help'];
</script>

{#snippet menuIcon(name: string)}
	<svg
		viewBox="0 0 24 24"
		class="h-4 w-4"
		fill="none"
		stroke="currentColor"
		stroke-width="1.7"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		{#if name === 'new'}
			<path d="M14 3v5h5" />
			<path d="M5 3h9l5 5v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
			<line x1="12" y1="12" x2="12" y2="18" />
			<line x1="9" y1="15" x2="15" y2="15" />
		{:else if name === 'open'}
			<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
		{:else if name === 'save'}
			<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
		{:else if name === 'export'}
			<path d="M12 14V3" />
			<polyline points="8 7 12 3 16 7" />
			<path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
		{:else if name === 'undo'}
			<polyline points="9 14 4 9 9 4" />
			<path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5h-4" />
		{:else if name === 'redo'}
			<polyline points="15 14 20 9 15 4" />
			<path d="M20 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h4" />
		{:else if name === 'cut'}
			<circle cx="6" cy="6" r="3" />
			<circle cx="6" cy="18" r="3" />
			<line x1="20" y1="4" x2="8.12" y2="15.88" />
			<line x1="14.47" y1="14.48" x2="20" y2="20" />
			<line x1="8.12" y1="8.12" x2="12" y2="12" />
		{:else if name === 'duplicate'}
			<rect x="9" y="9" width="11" height="11" rx="2" />
			<path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
			<line x1="12" y1="12" x2="17" y2="12" />
			<line x1="14.5" y1="9.5" x2="14.5" y2="14.5" />
		{:else if name === 'copy'}
			<rect x="9" y="9" width="11" height="11" rx="2" />
			<path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
		{:else if name === 'paste'}
			<rect x="8" y="3" width="8" height="3" rx="1" />
			<path d="M16 5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
		{:else if name === 'select-all'}
			<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="2 3" />
			<line x1="9" y1="12" x2="15" y2="12" />
			<line x1="12" y1="9" x2="12" y2="15" />
		{:else if name === 'delete'}
			<polyline points="3 6 5 6 21 6" />
			<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
			<path d="M10 11v6" />
			<path d="M14 11v6" />
			<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
		{:else if name === 'check'}
			<polyline points="5 12 10 17 19 8" />
		{:else if name === 'zoom-in'}
			<circle cx="11" cy="11" r="7" />
			<line x1="20" y1="20" x2="16" y2="16" />
			<line x1="11" y1="8" x2="11" y2="14" />
			<line x1="8" y1="11" x2="14" y2="11" />
		{:else if name === 'zoom-out'}
			<circle cx="11" cy="11" r="7" />
			<line x1="20" y1="20" x2="16" y2="16" />
			<line x1="8" y1="11" x2="14" y2="11" />
		{:else if name === 'fit'}
			<polyline points="4 9 4 4 9 4" />
			<polyline points="20 9 20 4 15 4" />
			<polyline points="4 15 4 20 9 20" />
			<polyline points="20 15 20 20 15 20" />
		{:else if name === 'bring-front'}
			<path d="M12 3l9 4-9 4-9-4 9-4z" />
			<path d="M3 12l9 4 9-4" />
			<path d="M3 17l9 4 9-4" opacity="0.45" />
		{:else if name === 'send-back'}
			<path d="M3 7l9-4 9 4-9 4-9-4z" opacity="0.45" />
			<path d="M3 12l9 4 9-4" opacity="0.7" />
			<path d="M3 17l9 4 9-4" />
		{:else if name === 'group'}
			<rect x="3" y="3" width="11" height="11" rx="1.5" />
			<rect x="10" y="10" width="11" height="11" rx="1.5" />
		{:else if name === 'ungroup'}
			<rect x="3" y="3" width="9" height="9" rx="1" stroke-dasharray="2 2" />
			<rect x="12" y="12" width="9" height="9" rx="1" stroke-dasharray="2 2" />
		{:else if name === 'info'}
			<circle cx="12" cy="12" r="9" />
			<line x1="12" y1="8" x2="12" y2="8" />
			<line x1="12" y1="11" x2="12" y2="16" />
		{:else if name === 'keyboard'}
			<rect x="2" y="6" width="20" height="12" rx="2" />
			<line x1="6" y1="10" x2="6" y2="10" />
			<line x1="10" y1="10" x2="10" y2="10" />
			<line x1="14" y1="10" x2="14" y2="10" />
			<line x1="18" y1="10" x2="18" y2="10" />
			<line x1="7" y1="14" x2="17" y2="14" />
		{:else if name === 'chevron-right'}
			<polyline points="9 6 15 12 9 18" />
		{/if}
	</svg>
{/snippet}

<header
	class="flex h-[52px] items-center gap-[0.4rem] bg-mq-maroon px-[0.85rem] text-white
		[font-family:system-ui,-apple-system,sans-serif]"
>
	<div
		class="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[7px] bg-mq-red"
		aria-label="EasyDraw"
	>
		<svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" aria-hidden="true">
			<rect x="3" y="3" width="8" height="8" rx="2" fill="#ffffff" />
			<rect x="13" y="13" width="8" height="8" rx="2" fill="#ffffff" />
			<path d="M11 7h4a2 2 0 0 1 2 2v4" stroke="#ffffff" stroke-width="1.8" />
		</svg>
	</div>

	<input
		class="min-w-[6rem] max-w-[18rem] rounded-[6px] border border-transparent bg-transparent px-2
			py-1 text-[0.95rem] font-bold text-white transition-colors duration-150
			hover:bg-white/[0.08] focus:border-white/40 focus:bg-white/[0.15] focus:outline-none"
		bind:value={editorMetaData.fileName}
		aria-label="Document file name"
		placeholder="Untitled"
	/>

	<span
		class="inline-flex h-6 flex-shrink-0 items-center gap-1.5 rounded-full bg-black/[0.18] px-2.5
			text-[0.78rem] font-semibold text-white/[0.92]"
	>
		<span class="h-[7px] w-[7px] rounded-full bg-[#ff5a5f]"></span>Draft
	</span>

	<nav class="ml-2 flex gap-[0.1rem]" data-menu-root>
		{#each menuLabels as label}
			<div class="relative">
				<button
					class="cursor-pointer rounded-[4px] border-none bg-transparent px-[0.7rem] py-[0.4rem]
						text-[0.9rem] text-white transition-colors duration-150 hover:bg-white/[0.18]
						focus-visible:outline-offset-1 focus-visible:[outline:2px_solid_rgba(255,255,255,0.6)]
						[&.active]:bg-white/[0.18]"
					class:active={openMenu === label}
					type="button"
					aria-haspopup="menu"
					aria-expanded={openMenu === label}
					onclick={() => toggleMenu(label)}
				>
					{label}
				</button>
				{#if openMenu === label}
					<div
						class="absolute top-[calc(100%+6px)] left-0 z-50 flex min-w-[240px] flex-col gap-px
							rounded-[10px] border border-line-dropdown bg-white p-1.5 text-[#2a2a2a]
							shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
						role="menu"
					>
						{#each menus[label] as item}
							{#if item.type === 'divider'}
								<div class="mx-1 my-1 h-px bg-[#e8e5de]" role="separator"></div>
							{:else}
								<div class="relative flex flex-col">
									<button
										type="button"
										role="menuitem"
										class="group flex w-full cursor-pointer items-center gap-3 rounded-md
											border-none bg-transparent px-3 py-2 text-left text-[0.875rem]
											text-[#2a2a2a] transition-colors duration-100
											enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon
											disabled:cursor-not-allowed disabled:text-[#b8b8b8]
											[&.active:not(:disabled)]:bg-mq-pink [&.active:not(:disabled)]:text-mq-maroon
											[&.danger]:text-[#b42318]
											[&.danger:not(:disabled)]:hover:bg-[#fdf2f1]
											[&.danger:not(:disabled)]:hover:text-[#b42318]"
										class:danger={item.danger}
										class:active={item.submenu && openSubmenu === item.label}
										disabled={item.disabled}
										onclick={() => runItem(item)}
									>
										<span
											class="inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center
												text-[#5a5c58]
												group-[:hover:not(:disabled)]:text-mq-maroon
												group-[.active:not(:disabled)]:text-mq-maroon
												group-[.danger]:text-[#b42318] group-disabled:text-[#c8c8c8]"
										>
											{#if item.toggle}
												{#if item.checked}
													{@render menuIcon('check')}
												{/if}
											{:else if item.icon}
												{@render menuIcon(item.icon)}
											{/if}
										</span>
										<span class="flex-1">{item.label}</span>
										{#if item.shortcut}
											<span
												class="text-[0.78rem] tabular-nums text-ink-muted
													group-[:hover:not(:disabled)]:text-mq-red
													group-[.active:not(:disabled)]:text-mq-red">{item.shortcut}</span
											>
										{:else if item.submenu}
											<span class="inline-flex h-3.5 w-3.5 text-ink-muted [&_svg]:size-3.5"
												>{@render menuIcon('chevron-right')}</span
											>
										{/if}
									</button>
									{#if item.submenu && openSubmenu === item.label}
										<div
											class="absolute top-[-6px] left-[calc(100%+4px)] z-50 flex min-w-[180px]
												flex-col gap-px rounded-[10px] border border-line-dropdown bg-white
												p-1.5 text-[#2a2a2a] shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
											role="menu"
										>
											{#each item.submenu as sub}
												<button
													type="button"
													role="menuitem"
													class="group flex w-full cursor-pointer items-center gap-3 rounded-md
														border-none bg-transparent px-3 py-2 text-left text-[0.875rem]
														text-[#2a2a2a] transition-colors duration-100
														enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon
														disabled:cursor-not-allowed disabled:text-[#b8b8b8]"
													disabled={sub.disabled}
													onclick={() => runItem(sub)}
												>
													<span class="inline-flex h-[18px] w-[18px] flex-shrink-0"></span>
													<span class="flex-1">{sub.label}</span>
													{#if sub.shortcut}
														<span
															class="text-[0.78rem] tabular-nums text-ink-muted
																group-[:hover:not(:disabled)]:text-mq-red"
															>{sub.shortcut}</span
														>
													{/if}
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</nav>

	<div class="flex-auto"></div>

	<div class="flex flex-shrink-0 items-center gap-2">
		<button
			type="button"
			class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[7px]
				border-none bg-transparent text-white/[0.92] transition-colors duration-[120ms]
				hover:bg-white/[0.16]"
			aria-label="Collaborators"
		>
			<svg
				viewBox="0 0 24 24"
				class="h-[19px] w-[19px]"
				fill="none"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="9" cy="8" r="3" />
				<path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
				<path d="M16 4a3 3 0 0 1 0 6" />
				<path d="M17.5 14c2.2.4 3.5 2 3.5 4" />
			</svg>
		</button>

		<div
			class="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full
				bg-mq-red-hover text-[0.75rem] font-bold tracking-[0.02em] text-white"
		>
			{USER_INITIALS}
		</div>

		<button
			type="button"
			class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[7px]
				border-none bg-transparent text-white/[0.92] transition-colors duration-[120ms]
				hover:bg-white/[0.16]"
			aria-label="Present"
		>
			<svg
				viewBox="0 0 24 24"
				class="h-[19px] w-[19px]"
				fill="none"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M8 5v14l11-7z" />
			</svg>
		</button>

		<button
			type="button"
			class="inline-flex h-[34px] cursor-pointer items-center gap-[7px] rounded-[8px] border-none
				bg-mq-red px-4 text-[0.88rem] font-semibold text-white transition-colors duration-[120ms]
				hover:bg-mq-red-hover"
			onclick={editor.share}
		>
			<svg
				viewBox="0 0 24 24"
				class="h-4 w-4"
				fill="none"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M22 2 11 13" />
				<path d="M22 2 15 22l-4-9-9-4 20-7z" />
			</svg>
			Share
		</button>

		<button
			type="button"
			class="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[7px]
				border-none bg-transparent text-white/[0.92] transition-colors duration-[120ms]
				hover:bg-white/[0.16]"
			aria-label="Copy link"
			onclick={editor.share}
		>
			<svg
				viewBox="0 0 24 24"
				class="h-[19px] w-[19px]"
				fill="none"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
				<path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
			</svg>
		</button>
	</div>
</header>
