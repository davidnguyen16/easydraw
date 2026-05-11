<script lang="ts">
    import { onDestroy } from 'svelte';
    import {
        persistSidebarState,
        setWidth,
        sidebarState
    } from '$lib/stores/sidebar.store.svelte';

    const KEYBOARD_STEP_PX = 20;
    let isDragging = $state(false);

    // Update sidebar width from a horizontal mouse position.
    function handleMouseMove(event: MouseEvent) {
        setWidth(event.clientX);
    }

    // Finalizes the drag: stop dragging and persist the width.
    function handleMouseUp() {
        if (!isDragging) return;
        isDragging = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        persistSidebarState();
    }

    // Starts dragging and adds mouse event listeners.
    function handleMouseDown(event: MouseEvent) {
        event.preventDefault();
        isDragging = true;
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        // Lock cursor and prevent text selection during drag.
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    // Keyboard support so resize is accessible without a mouse.
    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            setWidth(sidebarState.width - KEYBOARD_STEP_PX);
            persistSidebarState();
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            setWidth(sidebarState.width + KEYBOARD_STEP_PX);
            persistSidebarState();
        }
    }

    // Safety net: if component unmounts while dragging, clean up event listeners.
    onDestroy(() => {
        if (isDragging) {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });   
</script>

<!-- 'separator' is intentionally interactive here: per WAI-ARIA it doubles as a window-splitter -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div 
   class="resize-handle"
   class:dragging={isDragging}
   role="separator"
   tabindex="0"
   aria-orientation="vertical"
   aria-label="Resize sidebar"
   aria-valuenow={sidebarState.width}
   onmousedown={handleMouseDown}
   onkeydown={handleKeyDown}
></div>

<style>
    .resize-handle {
        position: absolute;
        top: 0;
        right: -3px;
        width: 6px;
        height: 100%;
        cursor: col-resize;
        background: transparent;
        z-index: 10;
        transition: background 0.15s ease;
    }

    .resize-handle:hover,
    .resize-handle.dragging {
        background-color: rgba(0, 120, 255, 0.4);
    }

    /* Visible focus ring for keyboard users */
    .resize-handle:focus-visible {
        outline: none;
        background: rgba(0, 120, 255, 0.6);
        box-shadow: 0 0 0 2px rgba(0, 120, 255, 0.5);
    }
</style>