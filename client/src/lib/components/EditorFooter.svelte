<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createPage,
		deletePage,
		editorStoreSvelte,
		renamePage,
		switchPage,
		visibleUnsavedPageIdsStore
	} from '$lib/stores/editor.store.svelte';

	let {
		onSwitchPage,
		onCreatePage,
		onDeletePage
	}: {
		onSwitchPage?: (pageId: string) => void;
		onCreatePage?: () => void;
		onDeletePage?: (pageId: string) => void;
	} = $props();

	let openMenuPageId: string | null = $state(null);

	// Closes any open page dropdown when the user clicks outside the footer.
	onMount(() => {
		const closeMenu = () => {
			openMenuPageId = null;
		};

		window.addEventListener('pointerdown', closeMenu);
		return () => {
			window.removeEventListener('pointerdown', closeMenu);
		};
	});

	// Creates a blank page and immediately activates it.
	function handleCreatePage() {
		if (onCreatePage) {
			onCreatePage();
		} else {
			createPage();
		}
		openMenuPageId = null;
	}

	// Switches the current page when a tab is clicked.
	function handleSwitchPage(pageId: string) {
		if (onSwitchPage) {
			onSwitchPage(pageId);
		} else {
			switchPage(pageId);
		}
		openMenuPageId = null;
	}

	// Toggles the dropdown menu for a specific page tab.
	function handleTogglePageMenu(pageId: string) {
		openMenuPageId = openMenuPageId === pageId ? null : pageId;
	}

	// Updates page name in store whenever the inline input changes.
	function handlePageNameInput(pageId: string, event: Event) {
		const input = event.target as HTMLInputElement;
		renamePage(pageId, input.value);
	}

	// Focuses the inline page-name input for quick renaming.
	function handleRenamePage(pageId: string) {
		switchPage(pageId);
		openMenuPageId = null;

		queueMicrotask(() => {
			const input = document.querySelector<HTMLInputElement>(
				`input[data-page-input-id="${pageId}"]`
			);
			input?.focus();
			input?.select();
		});
	}

	// Deletes the selected page.
	function handleDeletePage(pageId: string) {
		if (onDeletePage) {
			onDeletePage(pageId);
		} else {
			deletePage(pageId);
		}
		openMenuPageId = null;
	}
</script>

<footer
	class="relative z-[1] flex items-center justify-between gap-3 border-t border-line bg-white px-4
		py-2.5 shadow-[0_-3px_10px_rgba(0,0,0,0.04)] max-[900px]:flex-col max-[900px]:items-stretch"
	onpointerdown={(event) => event.stopPropagation()}
>
	<!-- Keep dropdowns visible above tabs instead of clipping in a scroll container. -->
	<div
		class="flex flex-auto flex-wrap items-center gap-2 overflow-visible"
		aria-label="Editor pages"
	>
		{#each $editorStoreSvelte.pages as page}
			<div class="relative inline-flex items-stretch" role="presentation">
				<input
					type="text"
					class="min-w-[50px] max-w-[90px] appearance-none rounded-l-lg border border-r-0 border-line
						bg-panel px-2.5 py-1.5 text-[0.9rem] leading-none text-ink-soft outline-none
						hover:bg-[#edebe5] focus:bg-white {$editorStoreSvelte.activePageId === page.id
						? 'border-mq-red bg-mq-pink text-mq-maroon'
						: ''}"
					value={page.name}
					data-page-input-id={page.id}
					onfocus={() => handleSwitchPage(page.id)}
					oninput={(event) => handlePageNameInput(page.id, event)}
				/>
				{#if $visibleUnsavedPageIdsStore.includes(page.id)}
					<span
						class="pointer-events-none absolute -top-1 -right-1 size-[9px] rounded-full border-2
							border-white bg-[#d6001c]"
						aria-label="Unsaved changes"
						title="Unsaved changes"
					></span>
				{/if}
				<button
					type="button"
					class="min-w-[32px] cursor-pointer whitespace-nowrap rounded-r-lg border border-line
						bg-panel px-2 py-1.5 text-[0.9rem] text-ink-soft hover:bg-[#edebe5]
						{$editorStoreSvelte.activePageId === page.id
						? 'border-mq-red bg-mq-pink text-mq-maroon'
						: ''}"
					aria-label="Open page options"
					aria-haspopup="menu"
					aria-expanded={openMenuPageId === page.id}
					onclick={() => handleTogglePageMenu(page.id)}
				>
					▾
				</button>

				{#if openMenuPageId === page.id}
					<div
						class="absolute right-0 bottom-[calc(100%+6px)] z-30 flex min-w-[112px] flex-col
							overflow-hidden rounded-lg border border-line bg-white
							shadow-[0_6px_20px_rgba(0,0,0,0.1)]"
						role="menu"
					>
						<button
							type="button"
							role="menuitem"
							class="cursor-pointer whitespace-nowrap bg-white px-2.5 py-1.5 text-left text-[0.9rem]
								text-ink-soft hover:bg-[#edebe5]"
							onclick={() => handleRenamePage(page.id)}
						>
							Rename
						</button>
						<button
							type="button"
							role="menuitem"
							class="cursor-pointer whitespace-nowrap bg-white px-2.5 py-1.5 text-left text-[0.9rem]
								text-[#b42318] hover:bg-[#edebe5] disabled:cursor-not-allowed disabled:opacity-50"
							onclick={() => handleDeletePage(page.id)}
							disabled={$editorStoreSvelte.pages.length <= 1}
						>
							Delete
						</button>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<button
		type="button"
		class="flex-none cursor-pointer whitespace-nowrap rounded-lg border border-line bg-white px-2.5
			py-1.5 text-[0.9rem] font-semibold text-ink-soft hover:bg-[#edebe5]"
		onclick={handleCreatePage}
	>
		+ New Page
	</button>
</footer>
