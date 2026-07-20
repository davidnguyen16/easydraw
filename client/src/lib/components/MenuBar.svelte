<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import UiIcon from '$lib/components/icons/UiIcon.svelte';
	import {
		editorMetaData,
		type DiagramStatus,
		visibleUnsavedPageIdsStore
	} from '$lib/stores/editor.store.svelte';
	import type { Exporter } from '$lib/exporters';
	import { goto } from '$app/navigation';
	import { accountInitials, authStore, logout } from '$lib/stores/auth.store.svelte';
	import { LayoutGrid, Settings as SettingsIcon, LogOut } from '@lucide/svelte';

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
		state: {
			zoomPercent: number;
			showGrid: boolean;
			snapToGrid: boolean;
			saveStatus: 'saved' | 'saving' | 'error';
		};
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
		present: () => void;
		toggleShowGrid: () => void;
		toggleSnapToGrid: () => void;
		share: () => void;
	}

	const editor = getContext<EditorContext>('editor');

	// Account for the avatar dropdown. The editor is behind the (app) auth guard
	// so authStore.user is populated; the fallbacks are just defensive.
	const accountName = $derived(authStore.user?.name ?? authStore.user?.email ?? 'Account');
	const accountEmail = $derived(authStore.user?.email ?? '');
	const hasNameAndEmail = $derived(!!(authStore.user?.name && authStore.user?.email));
	const userInitials = $derived(accountInitials(authStore.user));
	const DOCUMENT_STATUSES: { id: DiagramStatus; label: string; color: string }[] = [
		{ id: 'draft', label: 'Draft', color: '#f97316' },
		{ id: 'complete', label: 'Complete', color: '#22c55e' },
		{ id: 'archived', label: 'Archived', color: '#9ca3af' }
	];

	// Canvas dirtiness gives immediate feedback before the debounce effect runs;
	// saveStatus then keeps the spinner alive through both the debounce and the
	// real PATCH request. Metadata-only edits drive saveStatus directly.
	const saving = $derived(
		editor.state.saveStatus === 'saving' || $visibleUnsavedPageIdsStore.length > 0
	);
	const saveFailed = $derived(editor.state.saveStatus === 'error');
	const currentDocumentStatus = $derived(
		DOCUMENT_STATUSES.find((status) => status.id === editorMetaData.status) ??
			DOCUMENT_STATUSES[0]
	);

	let openMenu: string | null = $state(null);
	let openSubmenu: string | null = $state(null);
	let statusMenuOpen = $state(false);
	let userMenuOpen = $state(false);

	function toggleMenu(label: string) {
		openMenu = openMenu === label ? null : label;
		openSubmenu = null;
		statusMenuOpen = false;
		userMenuOpen = false;
	}

	function toggleStatusMenu() {
		const nextOpen = !statusMenuOpen;
		openMenu = null;
		openSubmenu = null;
		statusMenuOpen = nextOpen;
		userMenuOpen = false;
	}

	function selectStatus(status: DiagramStatus) {
		editorMetaData.status = status;
		statusMenuOpen = false;
	}

	function closeMenus() {
		openMenu = null;
		openSubmenu = null;
		statusMenuOpen = false;
		userMenuOpen = false;
	}

	function toggleUserMenu() {
		const nextOpen = !userMenuOpen;
		openMenu = null;
		openSubmenu = null;
		statusMenuOpen = false;
		userMenuOpen = nextOpen;
	}

	function goToDashboard() {
		userMenuOpen = false;
		goto('/dashboard');
	}

	function goToSettings() {
		userMenuOpen = false;
		goto('/settings');
	}

	async function signOut() {
		userMenuOpen = false;
		await logout();
		goto('/login');
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
			if (target?.closest('[data-menu-root], [data-status-root], [data-user-root]')) return;
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
			{
				icon: 'save-as',
				label: 'Save As…',
				shortcut: 'Ctrl+Shift+S',
				onClick: editor.saveAs
			},
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
				// Open the public landing page. The user stays logged in, so the
				// landing renders its authenticated state (Open dashboard + avatar).
				onClick: () => goto('/')
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
	<UiIcon {name} class="h-4 w-4" />
{/snippet}

<header
	class="flex h-[52px] items-center gap-[0.4rem] bg-mq-maroon px-[0.85rem] text-white
		[font-family:system-ui,-apple-system,sans-serif]"
>
	<a
		href="/dashboard"
		title="Back to dashboard"
		aria-label="Back to dashboard"
		class="flex flex-shrink-0 items-center rounded-md p-1 transition-colors hover:bg-white/10"
	>
		<svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
			<rect x="4" y="4" width="40" height="40" rx="8" fill="#A6192E" />
			<rect x="12" y="12" width="12" height="8" rx="2" fill="white" opacity="0.95" />
			<rect x="28" y="28" width="12" height="8" rx="2" fill="white" opacity="0.95" />
			<path
				d="M24 16 L28 16 L28 32"
				stroke="white"
				stroke-width="2"
				stroke-linecap="round"
				opacity="0.8"
			/>
		</svg>
	</a>

	<input
		class="min-w-[6rem] max-w-[18rem] rounded-[6px] border border-transparent bg-transparent px-2
			py-1 text-[0.95rem] font-bold text-white transition-colors duration-150
			hover:bg-white/[0.08] focus:border-white/40 focus:bg-white/[0.15] focus:outline-none"
		bind:value={editorMetaData.fileName}
		aria-label="Document file name"
		placeholder="Untitled"
	/>

	<div class="relative flex-shrink-0" data-status-root>
		<button
			type="button"
			class="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-full border-none
				bg-black/[0.18] px-2.5 text-[0.78rem] font-semibold text-white/[0.92]
				transition-colors duration-150 hover:bg-white/[0.18]
				focus-visible:outline-offset-1 focus-visible:[outline:2px_solid_rgba(255,255,255,0.6)]"
			aria-label="Document status"
			aria-haspopup="menu"
			aria-expanded={statusMenuOpen}
			onclick={toggleStatusMenu}
		>
			<span
				class="h-[7px] w-[7px] rounded-full"
				style={`background-color: ${currentDocumentStatus.color};`}
			></span>
			<span>{currentDocumentStatus.label}</span>
		</button>

		{#if statusMenuOpen}
			<div
				class="absolute top-[calc(100%+10px)] left-1/2 z-50 flex w-[220px] -translate-x-1/2
					flex-col gap-px rounded-[10px] border border-line-dropdown bg-white p-1.5
					text-[#2a2a2a] shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
				role="menu"
				aria-label="Document status"
			>
				<span
					class="absolute top-[-6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45
						border-t border-l border-line-dropdown bg-white"
					aria-hidden="true"
				></span>
				{#each DOCUMENT_STATUSES as status}
					<button
						type="button"
						role="menuitemradio"
						aria-checked={editorMetaData.status === status.id}
						class="group relative flex w-full cursor-pointer items-center gap-3 rounded-md
							border-none bg-transparent px-3 py-2 text-left text-[0.875rem] text-[#2a2a2a]
							transition-colors duration-100 enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon
							[&.active]:bg-mq-pink [&.active]:text-mq-maroon"
						class:active={editorMetaData.status === status.id}
						onclick={() => selectStatus(status.id)}
					>
						<span
							class="h-[9px] w-[9px] flex-shrink-0 rounded-full"
							style={`background-color: ${status.color};`}
						></span>
						<span class="flex-1">{status.label}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

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
											<span
												class="inline-flex h-3.5 w-3.5 text-ink-muted [&_svg]:size-3.5"
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
													<span
														class="inline-flex h-[18px] w-[18px] flex-shrink-0"
													></span>
													<span class="flex-1">{sub.label}</span>
													{#if sub.shortcut}
														<span
															class="text-[0.78rem] tabular-nums text-ink-muted
																group-[:hover:not(:disabled)]:text-mq-red">{sub.shortcut}</span
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
		<!-- Save status follows the real debounced PATCH lifecycle. Click to force
		     a save or retry after an error. -->
		<button
			type="button"
			class="mb-tip relative inline-flex h-8 w-8 cursor-pointer items-center justify-center
				rounded-[7px] border-none bg-transparent text-white/[0.92] transition-colors duration-[120ms]
				hover:bg-white/[0.16]"
			aria-label={saving ? 'Saving…' : saveFailed ? 'Save failed. Click to retry' : 'Saved'}
			onclick={editor.save}
		>
			{#if saving}
				<svg
					viewBox="0 0 24 24"
					class="h-[18px] w-[18px] animate-spin"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M23 4v6h-6" />
					<path d="M1 20v-6h6" />
					<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
					<path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
				</svg>
			{:else if saveFailed}
				<!-- Failed: cloud with an X; clicking retries through editor.save. -->
				<svg
					viewBox="0 0 24 24"
					class="h-[18px] w-[18px] text-red-200"
					fill="none"
					stroke="currentColor"
					stroke-width="1.7"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 15.3" />
					<path d="m9.5 12 5 5" />
					<path d="m14.5 12-5 5" />
				</svg>
			{:else}
				<!-- Saved: cloud with a check (image 2). -->
				<svg
					viewBox="0 0 24 24"
					class="h-[18px] w-[18px]"
					fill="none"
					stroke="currentColor"
					stroke-width="1.7"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 15.3" />
					<path d="m8.5 13.5 2.5 2.5 4.5-4.5" />
				</svg>
			{/if}
		</button>

		<div class="relative flex-shrink-0" data-user-root>
			<button
				type="button"
				class="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full
					border-none bg-mq-red-hover text-[0.75rem] font-bold tracking-[0.02em] text-white
					transition-colors duration-[120ms] hover:bg-mq-maroon
					focus-visible:outline-offset-1 focus-visible:[outline:2px_solid_rgba(255,255,255,0.6)]"
				title={accountName}
				aria-haspopup="menu"
				aria-expanded={userMenuOpen}
				onclick={toggleUserMenu}
			>
				{userInitials}
			</button>

			{#if userMenuOpen}
				<div
					class="absolute top-[calc(100%+8px)] right-0 z-50 flex w-56 flex-col rounded-[10px]
						border border-line-dropdown bg-white p-1.5 text-[#2a2a2a]
						shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
					role="menu"
					aria-label="Account"
				>
					<div class="px-2.5 py-1.5">
						<p class="text-[0.72rem] text-ink-muted">Signed in as</p>
						<p class="truncate text-[0.875rem] font-medium text-[#2a2a2a]">{accountName}</p>
						{#if hasNameAndEmail}
							<p class="truncate text-[0.72rem] text-ink-muted">{accountEmail}</p>
						{/if}
					</div>

					<div class="mx-1 my-1 h-px bg-[#e8e5de]" role="separator"></div>

					<button
						type="button"
						role="menuitem"
						class="group flex w-full cursor-pointer items-center gap-2.5 rounded-md border-none
							bg-transparent px-2.5 py-2 text-left text-[0.875rem] text-[#2a2a2a]
							transition-colors duration-100 enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon"
						onclick={goToDashboard}
					>
						<LayoutGrid size={15} class="flex-shrink-0 text-[#5a5c58] group-hover:text-mq-maroon" />
						My diagrams
					</button>
					<button
						type="button"
						role="menuitem"
						class="group flex w-full cursor-pointer items-center gap-2.5 rounded-md border-none
							bg-transparent px-2.5 py-2 text-left text-[0.875rem] text-[#2a2a2a]
							transition-colors duration-100 enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon"
						onclick={goToSettings}
					>
						<SettingsIcon size={15} class="flex-shrink-0 text-[#5a5c58] group-hover:text-mq-maroon" />
						Settings
					</button>
					<button
						type="button"
						role="menuitem"
						class="group flex w-full cursor-pointer items-center gap-2.5 rounded-md border-none
							bg-transparent px-2.5 py-2 text-left text-[0.875rem] text-[#2a2a2a]
							transition-colors duration-100 enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon"
						onclick={signOut}
					>
						<LogOut size={15} class="flex-shrink-0 text-[#5a5c58] group-hover:text-mq-maroon" />
						Sign out
					</button>
				</div>
			{/if}
		</div>

		<button
			type="button"
			class="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[8px]
				border-none bg-mq-red px-[18px] text-[0.95rem] font-semibold text-white transition-colors
				duration-[120ms] hover:bg-mq-red-hover"
			onclick={editor.present}
		>
			<svg
				viewBox="0 0 24 24"
				class="h-[19px] w-[19px]"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M8 5v14l11-7z" />
			</svg>
			Present
		</button>

		<button
			type="button"
			class="mb-tip relative inline-flex h-8 w-8 cursor-pointer items-center justify-center
				rounded-[7px] border-none bg-transparent text-white/[0.92] transition-colors duration-[120ms]
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

<style>
	/*
	 * Hover tooltip for the right-cluster icon buttons — same look as the
	 * ToolBar's `.tb-tip` (dark pill, drops below the button). Kept as scoped
	 * CSS because the text comes from `content: attr(aria-label)`, which
	 * Tailwind can't express (its --tw-content var wins → empty tooltip).
	 * `.mb-tip` buttons must be `relative` so the absolute tip anchors to them.
	 */
	.mb-tip::after {
		content: attr(aria-label);
		position: absolute;
		top: calc(100% + 7px);
		left: 50%;
		transform: translateX(-50%);
		background: #373a36;
		color: #fff;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
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
	.mb-tip:hover::after {
		opacity: 1;
		transition-delay: 0.45s;
	}
</style>
