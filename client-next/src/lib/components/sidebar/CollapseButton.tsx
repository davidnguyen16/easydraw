'use client';

import { useSidebarStore } from '@/lib/stores/sidebar.store';

// Toggles the sidebar's collapsed state and persists it. Port of CollapseButton.svelte.
export default function CollapseButton() {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const toggleCollapse = useSidebarStore((s) => s.toggleCollapse);
  const persist = useSidebarStore((s) => s.persist);

  return (
    <button
      type="button"
      className={`absolute top-3 z-20 flex size-6 cursor-pointer items-center justify-center rounded-full border border-line bg-white text-base leading-none text-ink-soft shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:bg-[#edebe5] ${
        isCollapsed ? '-right-8' : 'right-2'
      }`}
      aria-label={isCollapsed ? 'Open sidebar' : 'Close sidebar'}
      aria-expanded={!isCollapsed}
      onClick={() => {
        toggleCollapse();
        persist();
      }}
    >
      {isCollapsed ? '»' : '«'}
    </button>
  );
}
