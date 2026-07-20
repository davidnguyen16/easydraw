<script lang="ts">
	import { Plus, X, Layers, Menu, Check } from '@lucide/svelte';
	import {
		createPage,
		deletePage,
		editorStoreSvelte,
		renamePage,
		switchPage,
		visibleUnsavedPageIdsStore
	} from '$lib/stores/editor.store.svelte';
	import PageTabContextMenu from './PageTabContextMenu.svelte';

	let {
		nodeCount = 0,
		onSwitchPage,
		onCreatePage,
		onDeletePage,
		onDuplicatePage,
		onDeleteAllPages
	}: {
		nodeCount?: number;
		onSwitchPage?: (pageId: string) => void;
		onCreatePage?: () => void;
		onDeletePage?: (pageId: string) => void;
		onDuplicatePage?: (pageId: string) => void;
		onDeleteAllPages?: () => void;
	} = $props();

	let editingPageId = $state<string | null>(null);
	let editValue = $state('');
	let menuOpen = $state(false); // hamburger dropdown
	let contextMenu = $state<{ pageId: string; x: number; anchorTop: number } | null>(null);
	let hamburgerEl = $state<HTMLDivElement | null>(null);

	// Close the hamburger dropdown on a click outside it. (Footer-internal
	// actions close it explicitly; the footer stops its own pointerdowns, so
	// this only fires for clicks elsewhere on the page.)
	$effect(() => {
		if (!menuOpen) return;
		const onPointer = (event: PointerEvent) => {
			if (hamburgerEl && !hamburgerEl.contains(event.target as Node)) menuOpen = false;
		};
		window.addEventListener('pointerdown', onPointer);
		return () => window.removeEventListener('pointerdown', onPointer);
	});

	// Focus + select the rename input the moment it appears.
	function autofocus(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	function switchTo(pageId: string) {
		menuOpen = false;
		contextMenu = null;
		if (onSwitchPage) onSwitchPage(pageId);
		else switchPage(pageId);
	}

	function addPage() {
		menuOpen = false;
		contextMenu = null;
		if (onCreatePage) onCreatePage();
		else createPage();
	}

	function removePage(pageId: string) {
		contextMenu = null;
		if (onDeletePage) onDeletePage(pageId);
		else deletePage(pageId);
	}

	function deleteAll() {
		menuOpen = false;
		onDeleteAllPages?.();
	}

	function startRename(pageId: string, currentName: string) {
		menuOpen = false;
		contextMenu = null;
		editValue = currentName;
		editingPageId = pageId;
	}

	function commitRename() {
		if (editingPageId) {
			renamePage(editingPageId, editValue.trim() || 'Page');
		}
		editingPageId = null;
	}

	function openContextMenu(event: MouseEvent, pageId: string) {
		event.preventDefault();
		event.stopPropagation();
		menuOpen = false;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		contextMenu = { pageId, x: rect.left, anchorTop: rect.top };
	}
</script>

<footer
	class="flex h-9 flex-shrink-0 items-stretch justify-between border-t border-[#E0E0E0] bg-[#FAFAFA]
		select-none"
	onpointerdown={(event) => event.stopPropagation()}
>
	<!-- Hamburger menu + page tabs (left) -->
	<div class="flex min-w-0 flex-1 items-stretch">
		<!-- Hamburger menu -->
		<div class="relative flex flex-shrink-0 items-center" bind:this={hamburgerEl}>
			<button
				type="button"
				class="flex h-full w-9 items-center justify-center border-r border-[#E0E0E0] text-[#404040]
					transition-colors hover:bg-[#F0F0F0]"
				title="Page menu"
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				<Menu class="h-4 w-4" />
			</button>
			{#if menuOpen}
				<div
					class="absolute bottom-full left-0 z-50 mb-1 w-44 rounded border border-[#D4D4D4]
						bg-[#F4F4F4] py-1 shadow-lg"
					role="menu"
				>
					<button
						type="button"
						role="menuitem"
						class="flex w-full items-center px-3 py-1.5 text-left text-xs text-[#333333]
							hover:bg-[#E0E0E0]"
						onclick={addPage}
					>
						Insert Page
					</button>
					<div class="my-1 h-px bg-[#D4D4D4]"></div>
					<div class="max-h-56 overflow-y-auto">
						{#each $editorStoreSvelte.pages as page (page.id)}
							<button
								type="button"
								role="menuitem"
								class="flex w-full items-center px-3 py-1.5 text-left text-xs text-[#333333]
									hover:bg-[#E0E0E0]"
								onclick={() => switchTo(page.id)}
							>
								<span class="flex w-4 flex-shrink-0 items-center">
									{#if $editorStoreSvelte.activePageId === page.id}
										<Check class="h-3.5 w-3.5 text-[#1A1A1A]" />
									{/if}
								</span>
								<span class="truncate">{page.name}</span>
							</button>
						{/each}
					</div>
					<div class="my-1 h-px bg-[#D4D4D4]"></div>
					<button
						type="button"
						role="menuitem"
						class="flex w-full items-center px-3 py-1.5 text-left text-xs text-[#333333]
							hover:bg-[#E0E0E0]"
						onclick={deleteAll}
					>
						Delete All
					</button>
				</div>
			{/if}
		</div>

		<!-- Page tabs -->
		<div class="flex h-full min-w-0 flex-1 items-stretch overflow-x-auto">
			{#each $editorStoreSvelte.pages as page (page.id)}
				{@const isActive = $editorStoreSvelte.activePageId === page.id}
				{@const isEditing = editingPageId === page.id}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="group relative flex min-w-[104px] flex-shrink-0 cursor-pointer items-center
						justify-center border-r border-[#E0E0E0] px-7 transition-colors
						{isActive ? 'bg-white' : 'hover:bg-[#F0F0F0]'}"
					role="tab"
					tabindex="-1"
					aria-selected={isActive}
					onclick={() => !isEditing && switchTo(page.id)}
					ondblclick={(event) => {
						event.stopPropagation();
						startRename(page.id, page.name);
					}}
					oncontextmenu={(event) => openContextMenu(event, page.id)}
				>
					{#if isActive}
						<div class="absolute top-0 right-0 left-0 h-[2px] bg-mq-red"></div>
					{/if}

					{#if isEditing}
						<input
							class="h-full w-24 bg-white px-3 text-center text-xs outline-none"
							value={editValue}
							use:autofocus
							oninput={(event) => (editValue = event.currentTarget.value)}
							onblur={commitRename}
							onkeydown={(event) => {
								if (event.key === 'Enter') commitRename();
								if (event.key === 'Escape') editingPageId = null;
							}}
							onclick={(event) => event.stopPropagation()}
						/>
					{:else}
						<span
							class="max-w-[120px] truncate text-center text-xs font-medium text-[#2C2C2A]"
						>
							{page.name}
						</span>
						{#if $editorStoreSvelte.pages.length > 1}
							<button
								type="button"
								class="absolute right-1.5 rounded p-0.5 opacity-0 transition-all
									hover:bg-mq-red/15 group-hover:opacity-100"
								aria-label="Delete page"
								onclick={(event) => {
									event.stopPropagation();
									removePage(page.id);
								}}
							>
								<X class="h-3 w-3 text-[#6B6B6B]" />
							</button>
						{/if}
						<!-- Unsaved indicator (kept from this project; React had none). -->
						{#if $visibleUnsavedPageIdsStore.includes(page.id)}
							<span
								class="pointer-events-none absolute top-1 right-1 size-[7px] rounded-full bg-[#d6001c]"
								title="Unsaved changes"
							></span>
						{/if}
					{/if}
				</div>
			{/each}

			<button
				type="button"
				class="mx-1.5 flex w-7 flex-shrink-0 items-center justify-center rounded text-[#6B6B6B]
					transition-colors hover:bg-[#F0F0F0] hover:text-mq-red"
				title="Add page"
				aria-label="Add page"
				onclick={addPage}
			>
				<Plus class="h-4 w-4" />
			</button>
		</div>
	</div>

	<!-- Shape count (right) -->
	<div class="flex items-center gap-1.5 border-l border-[#E0E0E0] bg-white px-3">
		<Layers class="h-3.5 w-3.5 text-mq-red" />
		<span class="text-xs font-semibold text-[#2C2C2A] tabular-nums">{nodeCount}</span>
		<span class="text-xs text-[#6B6B6B]">shapes</span>
	</div>

	{#if contextMenu}
		<PageTabContextMenu
			x={contextMenu.x}
			anchorTop={contextMenu.anchorTop}
			canDelete={$editorStoreSvelte.pages.length > 1}
			onInsert={addPage}
			onDelete={() => removePage(contextMenu!.pageId)}
			onRename={() =>
				startRename(
					contextMenu!.pageId,
					$editorStoreSvelte.pages.find((p) => p.id === contextMenu!.pageId)?.name ?? ''
				)}
			onDuplicate={() => onDuplicatePage?.(contextMenu!.pageId)}
			onClose={() => (contextMenu = null)}
		/>
	{/if}
</footer>
