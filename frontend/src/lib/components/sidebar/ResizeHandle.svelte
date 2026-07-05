<script lang="ts">
	import { onDestroy } from 'svelte';
	import { persistSidebarState, setWidth, sidebarState } from '$lib/stores/sidebar.store.svelte';

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
		sidebarState.isResizing = false; // re-enable the width transition
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
		// Suppress the sidebar's width transition for the whole gesture so the
		// panel edge follows the cursor 1:1 instead of easing after it.
		sidebarState.isResizing = true;
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
			sidebarState.isResizing = false;
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
	class="absolute top-0 -right-[3px] z-10 h-full w-1.5 cursor-col-resize bg-transparent transition-colors duration-150 hover:bg-[rgba(166,25,46,0.35)] focus-visible:bg-[rgba(166,25,46,0.5)] focus-visible:shadow-[0_0_0_2px_rgba(166,25,46,0.4)] focus-visible:outline-none {isDragging
		? 'bg-[rgba(166,25,46,0.35)]'
		: ''}"
	role="separator"
	tabindex="0"
	aria-orientation="vertical"
	aria-label="Resize sidebar"
	aria-valuenow={sidebarState.width}
	onmousedown={handleMouseDown}
	onkeydown={handleKeyDown}
></div>

