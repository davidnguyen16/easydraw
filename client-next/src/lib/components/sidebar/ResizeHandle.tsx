'use client';

import { useEffect, useRef, useState } from 'react';
import { useSidebarStore, SIDEBAR_RESIZE_HANDLE_OVERHANG_PX } from '@/lib/stores/sidebar.store';

// Draggable window-splitter for the sidebar width. Port of ResizeHandle.svelte.
const KEYBOARD_STEP_PX = 20;

export default function ResizeHandle() {
  const width = useSidebarStore((s) => s.width);
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);

  // Safety net: clean up if unmounted mid-drag.
  useEffect(() => {
    return () => {
      if (draggingRef.current) {
        useSidebarStore.getState().setResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []);

  function handleMouseDown(event: React.MouseEvent) {
    event.preventDefault();
    draggingRef.current = true;
    setIsDragging(true);
    useSidebarStore.getState().setResizing(true); // suppress the width transition

    const onMove = (e: MouseEvent) => useSidebarStore.getState().setWidth(e.clientX);
    const onUp = () => {
      draggingRef.current = false;
      setIsDragging(false);
      useSidebarStore.getState().setResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      useSidebarStore.getState().persist();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    const st = useSidebarStore.getState();
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      st.setWidth(st.width - KEYBOARD_STEP_PX);
      st.persist();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      st.setWidth(st.width + KEYBOARD_STEP_PX);
      st.persist();
    }
  }

  return (
    <div
      className={`absolute top-0 z-10 h-full w-1.5 cursor-col-resize bg-transparent transition-colors duration-150 hover:bg-[rgba(166,25,46,0.35)] focus-visible:bg-[rgba(166,25,46,0.5)] focus-visible:shadow-[0_0_0_2px_rgba(166,25,46,0.4)] focus-visible:outline-none ${
        isDragging ? 'bg-[rgba(166,25,46,0.35)]' : ''
      }`}
      style={{ right: -SIDEBAR_RESIZE_HANDLE_OVERHANG_PX }}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
    />
  );
}
