<script lang="ts">
    import { editorMetaData } from '$lib/stores/editor.store.svelte';

    const APP_INITIAL = 'E';
    const USER_INITIALS = 'SK';
    const MENU_ITEMS = ['File', 'Edit', 'View', 'Arrange', 'Extras', 'Help'];
</script>

<header class="menu-bar">
    <div class="brand-icon">{APP_INITIAL}</div>

    <div class="center-stack">
        <input class="file-name"
            bind:value={editorMetaData.fileName}
            aria-label="Document file name"
            placeholder = "Untitled"
        />

        <nav class="menus">
            {#each MENU_ITEMS as label}
                <button class="menu-trigger" type="button">{label}</button>
            {/each}
        </nav>
    </div>

    <div class="avatar">{USER_INITIALS}</div>
</header>                  

<style>
	.menu-bar {
		display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 1rem;
		background: #76232F;
		color: white;
		font-family: system-ui, -apple-system, sans-serif;
	}

    .center-stack {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
    } 

    .menus {
        display: flex;
        gap: 0.25rem;
    }

	.brand-icon {
		width: 48px;
		height: 48px;
		background: #8B2A38;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		font-weight: 700;
		font-size: 0.95rem;
	}

	.file-name {
		background: transparent;
		border: 1px solid transparent;
		color: white;
		font-weight: 700;
		font-size: 1rem;
		font-family: inherit;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		min-width: 8rem;
		max-width: 22rem;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.file-name:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.file-name:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.15);
		border-color: rgba(255, 255, 255, 0.4);
	}

	.menu-trigger {
		background: transparent;
		border: none;
		color: white;
		padding: 0.4rem 0.7rem;
		font-size: 0.9rem;
		cursor: pointer;
		border-radius: 4px;
		font-family: inherit;
		transition: background 0.15s ease;
	}

	.menu-trigger:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	.menu-trigger:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.6);
		outline-offset: 1px;
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: #6B4DBA;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 0.8rem;
		letter-spacing: 0.02em;
	}
</style>