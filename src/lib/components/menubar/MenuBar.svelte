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
    }

    const editor = getContext<EditorContext>('editor');

    const APP_INITIAL = 'E';
    const USER_INITIALS = 'SK';

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
            if (target?.closest('.menu-bar .menus')) return;
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
            { icon: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', onClick: editor.undo, disabled: !editor.history.canUndo },
            { icon: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', onClick: editor.redo, disabled: !editor.history.canRedo },
            { type: 'divider' },
            { icon: 'cut', label: 'Cut', shortcut: 'Ctrl+X', onClick: editor.cut },
            { icon: 'copy', label: 'Copy', shortcut: 'Ctrl+C', onClick: editor.copy },
            { icon: 'paste', label: 'Paste', shortcut: 'Ctrl+V', onClick: editor.paste },
            { icon: 'duplicate', label: 'Duplicate', shortcut: 'Ctrl+D', onClick: editor.duplicate },
            { type: 'divider' },
            { icon: 'select-all', label: 'Select all', shortcut: 'Ctrl+A', onClick: editor.selectAll },
            { type: 'divider' },
            { icon: 'delete', label: 'Delete', shortcut: 'Del', onClick: editor.deleteSelected, danger: true }
        ],
        View: [
            { toggle: true, label: 'Show grid', checked: editor.state.showGrid, onClick: editor.toggleShowGrid },
            { toggle: true, label: 'Snap to grid', checked: editor.state.snapToGrid, onClick: editor.toggleSnapToGrid },
            { type: 'divider' },
            { icon: 'zoom-in', label: 'Zoom in', shortcut: 'Ctrl+=', onClick: editor.zoomIn },
            { icon: 'zoom-out', label: 'Zoom out', shortcut: 'Ctrl+-', onClick: editor.zoomOut },
            { icon: 'fit', label: 'Fit to screen', shortcut: 'Ctrl+Shift+H', onClick: editor.fitView }
        ],
        Arrange: [
            { icon: 'bring-front', label: 'Bring to front', shortcut: 'Ctrl+Shift+F', onClick: editor.bringToFront },
            { icon: 'send-back', label: 'Send to back', shortcut: 'Ctrl+Shift+B', onClick: editor.sendToBack },
            { type: 'divider' },
            { icon: 'group', label: 'Group', shortcut: 'Ctrl+G', onClick: editor.group },
            { icon: 'ungroup', label: 'Ungroup', shortcut: 'Ctrl+Shift+G', onClick: editor.ungroup }
        ],
        Help: [
            { icon: 'info', label: 'About EasyDraw', onClick: () => alert('EasyDraw — a free diagram editor.') },
            { icon: 'keyboard', label: 'Keyboard shortcuts', onClick: () => alert('Save: Ctrl+S\nSave As: Ctrl+Shift+S\nOpen: Ctrl+O\nNew: Ctrl+N\nUndo: Ctrl+Z\nRedo: Ctrl+Y\nCut: Ctrl+X\nCopy: Ctrl+C\nPaste: Ctrl+V\nDuplicate: Ctrl+D\nSelect All: Ctrl+A\nDelete: Del\nGroup: Ctrl+G\nUngroup: Ctrl+Shift+G\nBring to Front: Ctrl+Shift+F\nSend to Back: Ctrl+Shift+B\nZoom In: Ctrl+=\nZoom Out: Ctrl+-\nFit to Screen: Ctrl+Shift+H') }
        ]
    });

    const menuLabels = ['File', 'Edit', 'View', 'Arrange', 'Help'];
</script>

{#snippet menuIcon(name: string)}
    <svg viewBox="0 0 24 24" class="item-icon" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
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

<header class="menu-bar">
    <div class="brand-icon">{APP_INITIAL}</div>

    <div class="center-stack">
        <input class="file-name"
            bind:value={editorMetaData.fileName}
            aria-label="Document file name"
            placeholder="Untitled"
        />

        <nav class="menus">
            {#each menuLabels as label}
                <div class="menu-wrapper">
                    <button
                        class="menu-trigger"
                        class:active={openMenu === label}
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={openMenu === label}
                        onclick={() => toggleMenu(label)}
                    >
                        {label}
                    </button>
                    {#if openMenu === label}
                        <div class="dropdown" role="menu">
                            {#each menus[label] as item}
                                {#if item.type === 'divider'}
                                    <div class="dropdown-divider" role="separator"></div>
                                {:else}
                                    <div class="item-wrapper">
                                        <button
                                            type="button"
                                            role="menuitem"
                                            class="dropdown-item"
                                            class:danger={item.danger}
                                            class:has-submenu={!!item.submenu}
                                            class:active={item.submenu && openSubmenu === item.label}
                                            disabled={item.disabled}
                                            onclick={() => runItem(item)}
                                        >
                                            <span class="item-icon-wrap">
                                                {#if item.toggle}
                                                    {#if item.checked}
                                                        {@render menuIcon('check')}
                                                    {/if}
                                                {:else if item.icon}
                                                    {@render menuIcon(item.icon)}
                                                {/if}
                                            </span>
                                            <span class="item-label">{item.label}</span>
                                            {#if item.shortcut}
                                                <span class="item-shortcut">{item.shortcut}</span>
                                            {:else if item.submenu}
                                                <span class="item-chevron">{@render menuIcon('chevron-right')}</span>
                                            {/if}
                                        </button>
                                        {#if item.submenu && openSubmenu === item.label}
                                            <div class="dropdown submenu" role="menu">
                                                {#each item.submenu as sub}
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        class="dropdown-item"
                                                        disabled={sub.disabled}
                                                        onclick={() => runItem(sub)}
                                                    >
                                                        <span class="item-icon-wrap"></span>
                                                        <span class="item-label">{sub.label}</span>
                                                        {#if sub.shortcut}
                                                            <span class="item-shortcut">{sub.shortcut}</span>
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

    .menu-wrapper {
        position: relative;
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

    .menu-trigger:hover,
    .menu-trigger.active {
        background: rgba(255, 255, 255, 0.18);
    }

    .menu-trigger:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.6);
        outline-offset: 1px;
    }

    .dropdown {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        min-width: 240px;
        background: #ffffff;
        color: #2a2a2a;
        border: 1px solid #ebe5d8;
        border-radius: 10px;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
        padding: 6px;
        z-index: 50;
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .submenu {
        top: -6px;
        left: calc(100% + 4px);
        min-width: 180px;
    }

    .item-wrapper {
        position: relative;
        display: flex;
        flex-direction: column;
    }

    .dropdown-item {
        display: flex;
        align-items: center;
        gap: 12px;
        background: transparent;
        border: none;
        color: #2a2a2a;
        font-family: inherit;
        font-size: 0.875rem;
        padding: 8px 12px;
        text-align: left;
        cursor: pointer;
        border-radius: 6px;
        width: 100%;
        transition: background 0.1s ease, color 0.1s ease;
    }

    .dropdown-item:hover:not(:disabled),
    .dropdown-item.active:not(:disabled) {
        background: #fbeef0;
        color: #76232F;
    }

    .dropdown-item:disabled {
        color: #b8b8b8;
        cursor: not-allowed;
    }

    .dropdown-item.danger {
        color: #b42318;
    }

    .dropdown-item.danger:hover:not(:disabled) {
        background: #fdf2f1;
        color: #b42318;
    }

    .item-icon-wrap {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #555;
    }

    .dropdown-item:hover:not(:disabled) .item-icon-wrap,
    .dropdown-item.active:not(:disabled) .item-icon-wrap {
        color: #76232F;
    }

    .dropdown-item.danger .item-icon-wrap {
        color: #b42318;
    }

    .dropdown-item:disabled .item-icon-wrap {
        color: #c8c8c8;
    }

    .item-icon {
        width: 16px;
        height: 16px;
    }

    .item-label {
        flex: 1;
    }

    .item-shortcut {
        font-size: 0.78rem;
        color: #9a9a9a;
        font-variant-numeric: tabular-nums;
    }

    .dropdown-item:hover:not(:disabled) .item-shortcut,
    .dropdown-item.active:not(:disabled) .item-shortcut {
        color: #b06070;
    }

    .item-chevron {
        display: inline-flex;
        width: 14px;
        height: 14px;
        color: #888;
    }

    .item-chevron .item-icon {
        width: 14px;
        height: 14px;
    }

    .dropdown-divider {
        height: 1px;
        background: #eee;
        margin: 4px 4px;
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
