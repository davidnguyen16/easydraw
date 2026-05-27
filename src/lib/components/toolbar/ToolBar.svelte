<script lang="ts">
    import { getContext, onMount } from 'svelte';

    interface EditorContext {
        state: { zoomPercent: number; locked: boolean };
        history: { canUndo: boolean; canRedo: boolean };
        save: () => void;
        open: () => void;
        undo: () => void;
        redo: () => void;
        zoomIn: () => void;
        zoomOut: () => void;
        fitView: () => void;
        fitSelection: () => void;
        setZoom: (percent: number) => void;
        toggleLock: () => void;
        duplicate: () => void;
        deleteSelected: () => void;
        share: () => void;
    }

    const editor = getContext<EditorContext>('editor');

    const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200];

    let zoomMenuOpen = $state(false);

    function toggleZoomMenu() {
        zoomMenuOpen = !zoomMenuOpen;
    }

    function closeZoomMenu() {
        zoomMenuOpen = false;
    }

    function pickZoom(percent: number) {
        editor.setZoom(percent);
        closeZoomMenu();
    }

    function pickFitView() {
        editor.fitView();
        closeZoomMenu();
    }

    function pickFitSelection() {
        editor.fitSelection();
        closeZoomMenu();
    }

    // Close dropdown on outside click or Escape.
    onMount(() => {
        const onPointer = (event: PointerEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('.zoom-menu-wrapper')) return;
            closeZoomMenu();
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeZoomMenu();
        };
        window.addEventListener('pointerdown', onPointer);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('pointerdown', onPointer);
            window.removeEventListener('keydown', onKey);
        };
    });
</script>

<div class="toolbar">
    <div class="group">
        <button type="button" class="icon-btn" aria-label="Open file" onclick={editor.open}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            </svg>
        </button>
        <button type="button" class="icon-btn" aria-label="Save" onclick={editor.save}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            </svg>
        </button>
    </div>

    <div class="separator"></div>

    <div class="group">
        <button
            type="button"
            class="icon-btn"
            aria-label="Undo"
            onclick={editor.undo}
            disabled={!editor.history.canUndo}
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 14 4 9 9 4" />
                <path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5h-4" />
            </svg>
        </button>
        <button
            type="button"
            class="icon-btn"
            aria-label="Redo"
            onclick={editor.redo}
            disabled={!editor.history.canRedo}
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 14 20 9 15 4" />
                <path d="M20 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h4" />
            </svg>
        </button>
    </div>

    <div class="separator"></div>

    <div class="group">
        <button type="button" class="icon-btn" aria-label="Zoom in" onclick={editor.zoomIn}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="20" y1="20" x2="16" y2="16" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
        </button>
        <button type="button" class="icon-btn" aria-label="Zoom out" onclick={editor.zoomOut}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="20" y1="20" x2="16" y2="16" />
                <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
        </button>

        <div class="zoom-menu-wrapper">
            <button
                type="button"
                class="zoom-trigger"
                class:active={zoomMenuOpen}
                aria-haspopup="menu"
                aria-expanded={zoomMenuOpen}
                onclick={toggleZoomMenu}
            >
                {editor.state.zoomPercent}%
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="zoom-chevron">
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {#if zoomMenuOpen}
                <div class="zoom-dropdown" role="menu">
                    <div class="zoom-section-label">ZOOM LEVEL</div>
                    {#each ZOOM_PRESETS as preset}
                        <button
                            type="button"
                            role="menuitem"
                            class="zoom-item"
                            class:checked={preset === editor.state.zoomPercent}
                            onclick={() => pickZoom(preset)}
                        >
                            <span class="zoom-check">
                                {#if preset === editor.state.zoomPercent}
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="5 12 10 17 19 8" />
                                    </svg>
                                {/if}
                            </span>
                            <span class="zoom-value">{preset}%</span>
                        </button>
                    {/each}
                    <div class="zoom-divider"></div>
                    <button type="button" role="menuitem" class="zoom-item action" onclick={pickFitView}>
                        <span class="zoom-action-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="4 9 4 4 9 4" />
                                <polyline points="20 9 20 4 15 4" />
                                <polyline points="4 15 4 20 9 20" />
                                <polyline points="20 15 20 20 15 20" />
                            </svg>
                        </span>
                        <span class="zoom-action-label">Fit to screen</span>
                    </button>
                    <button type="button" role="menuitem" class="zoom-item action" onclick={pickFitSelection}>
                        <span class="zoom-action-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M4 4l5 5" />
                                <path d="M20 4l-5 5" />
                                <path d="M4 20l5 -5" />
                                <path d="M20 20l-5 -5" />
                                <polyline points="4 4 4 8" />
                                <polyline points="4 4 8 4" />
                                <polyline points="20 4 20 8" />
                                <polyline points="20 4 16 4" />
                                <polyline points="4 20 4 16" />
                                <polyline points="4 20 8 20" />
                                <polyline points="20 20 20 16" />
                                <polyline points="20 20 16 20" />
                            </svg>
                        </span>
                        <span class="zoom-action-label">Fit selection</span>
                    </button>
                </div>
            {/if}
        </div>

        <button type="button" class="icon-btn" aria-label="Fit to screen" onclick={editor.fitView}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="4 9 4 4 9 4" />
                <polyline points="20 9 20 4 15 4" />
                <polyline points="4 15 4 20 9 20" />
                <polyline points="20 15 20 20 15 20" />
            </svg>
        </button>
        <button
            type="button"
            class="icon-btn"
            class:toggled={editor.state.locked}
            aria-label={editor.state.locked ? 'Unlock canvas' : 'Lock canvas'}
            aria-pressed={editor.state.locked}
            onclick={editor.toggleLock}
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                {#if editor.state.locked}
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                {:else}
                    <path d="M8 11V7a4 4 0 0 1 7.5 -2" />
                {/if}
            </svg>
        </button>
    </div>

    <div class="separator"></div>

    <div class="group">
        <button type="button" class="icon-btn" aria-label="Duplicate" onclick={editor.duplicate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
            </svg>
        </button>
        <button type="button" class="icon-btn" aria-label="Delete" onclick={editor.deleteSelected}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
        </button>
    </div>

    <div class="spacer"></div>

    <button type="button" class="share-btn" onclick={editor.share}>Share</button>
</div>

<style>
    .toolbar {
        flex: 0 0 44px;
        width: 100%;
        background: white;
        border-bottom: 1px solid #D6D2C4;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 12px;
    }

    .group {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .separator {
        width: 1px;
        height: 22px;
        background: #D6D2C4;
        margin: 0 6px;
    }

    .spacer {
        flex: 1 1 auto;
    }

    .icon-btn {
        position: relative;
        width: 32px;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 6px;
        color: #5A5C58;
        cursor: pointer;
        padding: 0;
        transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
    }

    .icon-btn:hover:not(:disabled) {
        background: #EDEBE5;
        color: #373A36;
    }

    .icon-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }

    .icon-btn:focus-visible {
        outline: none;
        border-color: #76232F;
        background: #f7eef0;
    }

    .icon-btn.toggled {
        color: #76232F;
        background: #fbeef0;
    }

    .icon-btn svg {
        width: 18px;
        height: 18px;
    }

    .icon-btn::after {
        content: attr(aria-label);
        position: absolute;
        top: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        background: #373A36;
        color: #fff;
        font-size: 0.72rem;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: 4px;
        white-space: nowrap;
        z-index: 200;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.12s ease;
        transition-delay: 0s;
    }

    .icon-btn::before {
        content: '';
        position: absolute;
        top: calc(100% + 3px);
        left: 50%;
        transform: translateX(-50%);
        border: 4px solid transparent;
        border-bottom-color: #373A36;
        z-index: 200;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.12s ease;
        transition-delay: 0s;
    }

    .icon-btn:hover::after,
    .icon-btn:hover::before,
    .icon-btn:focus-visible::after,
    .icon-btn:focus-visible::before {
        opacity: 1;
        transition-delay: 0.4s;
    }

    /* Zoom-level dropdown trigger and menu */
    .zoom-menu-wrapper {
        position: relative;
    }

    .zoom-trigger {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 28px;
        padding: 0 8px;
        font-size: 0.82rem;
        color: #5A5C58;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 6px;
        cursor: pointer;
        font-variant-numeric: tabular-nums;
        min-width: 64px;
        justify-content: center;
        transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
    }

    .zoom-trigger:hover {
        background: #EDEBE5;
        color: #373A36;
    }

    .zoom-trigger.active {
        border-color: #A6192E;
        color: #76232F;
        background: #fff;
    }

    .zoom-chevron {
        width: 12px;
        height: 12px;
    }

    .zoom-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        min-width: 200px;
        background: #ffffff;
        border: 1px solid #ebe5d8;
        border-radius: 10px;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.14);
        padding: 6px;
        z-index: 100;
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .zoom-section-label {
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #8A8B83;
        padding: 8px 12px 6px;
    }

    .zoom-item {
        display: flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: none;
        color: #373A36;
        font-family: inherit;
        font-size: 0.88rem;
        padding: 8px 12px;
        text-align: left;
        cursor: pointer;
        border-radius: 6px;
        width: 100%;
        transition: background 0.1s ease, color 0.1s ease;
    }

    .zoom-item:hover {
        background: #fbeef0;
        color: #76232F;
    }

    .zoom-item.checked {
        background: #fbeef0;
        color: #76232F;
    }

    .zoom-check {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #76232F;
    }

    .zoom-check svg {
        width: 14px;
        height: 14px;
    }

    .zoom-value {
        flex: 1;
        text-align: left;
        font-variant-numeric: tabular-nums;
    }

    .zoom-divider {
        height: 1px;
        background: #E8E5DE;
        margin: 4px 4px;
    }

    .zoom-action-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #5A5C58;
    }

    .zoom-action-icon svg {
        width: 16px;
        height: 16px;
    }

    .zoom-item.action:hover .zoom-action-icon {
        color: #76232F;
    }

    .zoom-action-label {
        flex: 1;
    }

    .share-btn {
        background: #A6192E;
        color: white;
        border: none;
        font-weight: 600;
        font-size: 0.9rem;
        padding: 7px 22px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.12s ease;
    }

    .share-btn:hover {
        background: #8B2A38;
    }

    .share-btn:focus-visible {
        outline: 2px solid rgba(118, 35, 47, 0.4);
        outline-offset: 2px;
    }
</style>
