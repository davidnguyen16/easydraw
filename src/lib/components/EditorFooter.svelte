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

<footer class="editor-footer" onpointerdown={(event) => event.stopPropagation()}>
	<div class="page-tabs" aria-label="Editor pages">
		{#each $editorStoreSvelte.pages as page}
			<div class="page-item" role="presentation">
				<input
					type="text"
					class="page-name-input"
					class:active={$editorStoreSvelte.activePageId === page.id}
					value={page.name}
					data-page-input-id={page.id}
					onfocus={() => handleSwitchPage(page.id)}
					oninput={(event) => handlePageNameInput(page.id, event)}
				/>
				{#if $visibleUnsavedPageIdsStore.includes(page.id)}
					<span class="unsaved-dot" aria-label="Unsaved changes" title="Unsaved changes"
					></span>
				{/if}
				<button
					type="button"
					class="menu-toggle"
					aria-label="Open page options"
					aria-haspopup="menu"
					aria-expanded={openMenuPageId === page.id}
					class:active={$editorStoreSvelte.activePageId === page.id}
					onclick={() => handleTogglePageMenu(page.id)}
				>
					▾
				</button>

				{#if openMenuPageId === page.id}
					<div class="page-menu" role="menu">
						<button
							type="button"
							role="menuitem"
							class="menu-item"
							onclick={() => handleRenamePage(page.id)}
						>
							Rename
						</button>
						<button
							type="button"
							role="menuitem"
							class="menu-item danger"
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

	<button type="button" class="add-page" onclick={handleCreatePage}> + New Page </button>
</footer>

<style>
	/* Footer row that sits below the editor canvas and sidebar area. */
	.editor-footer {
		position: relative;
		z-index: 1;

		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;

		padding: 10px 16px;
		background: #ffffff;
		border-top: 1px solid #d6d2c4;
		box-shadow: 0 -3px 10px rgba(0, 0, 0, 0.04);
	}

	/* Horizontal tabs for existing pages. */
	.page-tabs {
		display: flex;
		align-items: center;
		gap: 8px;
		/* Keep dropdowns visible above tabs instead of clipping in a scroll container. */
		overflow: visible;
		flex-wrap: wrap;
		flex: 1 1 auto;
	}

	button {
		border: 1px solid #d6d2c4;
		background: #f5f3ef;
		color: #373a36;
		padding: 6px 10px;
		border-radius: 8px;
		font-size: 0.9rem;
		cursor: pointer;
		white-space: nowrap;
	}

	button:hover {
		background: #edebe5;
	}

	/* Groups a page tab and its dropdown trigger together. */
	.page-item {
		position: relative;
		display: inline-flex;
		align-items: stretch;
	}

	/* Shows unsaved status when store data is newer than localStorage snapshot. */
	.unsaved-dot {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 9px;
		height: 9px;
		background: #d6001c;
		border: 2px solid #ffffff;
		border-radius: 999px;
		pointer-events: none;
	}

	.page-name-input {
		appearance: none;
		-webkit-appearance: none;
		border: 1px solid #d6d2c4;
		background: #f5f3ef;
		color: #373a36;
		padding: 6px 10px;
		border-radius: 8px 0 0 8px;
		font-size: 0.9rem;
		line-height: 1;
		min-width: 50px;
		max-width: 90px;
		border-right: none;
		outline: none;
	}

	.page-name-input:hover {
		background: #edebe5;
	}

	.page-name-input:focus {
		background: #ffffff;
	}

	.menu-toggle {
		padding: 6px 8px;
		border-radius: 0 8px 8px 0;
		min-width: 32px;
	}

	/* Active page tab state. */
	.page-name-input.active,
	.menu-toggle.active {
		background: #fbeef0;
		border-color: #a6192e;
		color: #76232f;
	}

	/* Dropdown menu anchored to each page item. */
	.page-menu {
		position: absolute;
		right: 0;
		top: auto;
		bottom: calc(100% + 6px);
		display: flex;
		flex-direction: column;
		min-width: 112px;
		background: #ffffff;
		border: 1px solid #d6d2c4;
		border-radius: 8px;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		z-index: 30;
	}

	.menu-item {
		border: none;
		background: #ffffff;
		border-radius: 0;
		text-align: left;
		color: #373a36;
	}

	.menu-item:hover {
		background: #edebe5;
	}

	.menu-item.danger {
		color: #b42318;
	}

	.menu-item:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.add-page {
		background: #ffffff;
		color: #373a36;
		font-weight: 600;
		flex: 0 0 auto;
	}

	@media (max-width: 900px) {
		.editor-footer {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
