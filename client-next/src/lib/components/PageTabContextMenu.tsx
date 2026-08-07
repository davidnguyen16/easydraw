'use client';

import { useEffect, useRef } from 'react';
import { ArrowUpFromLine, X, TextCursorInput, Files } from 'lucide-react';

export default function PageTabContextMenu({
  x,
  anchorTop,
  canDelete = true,
  onInsert,
  onDelete,
  onRename,
  onDuplicate,
  onClose,
}: {
  /** Screen x (px) to anchor the menu's left edge to. */
  x: number;
  /** Screen y (px) of the tab's top edge — the menu opens upward from here. */
  anchorTop: number;
  canDelete?: boolean;
  onInsert: () => void;
  onDelete: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // The footer sits at the bottom of the screen, so the menu opens UPWARD.
  const bottom = typeof window !== 'undefined' ? window.innerHeight - anchorTop + 4 : 0;

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const run = (action: () => void, enabled = true) => {
    if (enabled) action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] w-40 rounded-md border border-[#E0E0E0] bg-white py-1 shadow-lg"
      style={{ left: x, bottom }}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#333333] hover:bg-[#F5F5F5]"
        onClick={() => run(onInsert)}
      >
        <ArrowUpFromLine className="h-4 w-4 text-[#2196F3]" />
        <span>Insert</span>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!canDelete}
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#333333] hover:bg-[#F5F5F5] disabled:pointer-events-none disabled:opacity-40"
        onClick={() => run(onDelete, canDelete)}
      >
        <X className="h-4 w-4 text-[#E53935]" />
        <span>Delete</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#333333] hover:bg-[#F5F5F5]"
        onClick={() => run(onRename)}
      >
        <TextCursorInput className="h-4 w-4 text-[#2196F3]" />
        <span>Rename</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[#333333] hover:bg-[#F5F5F5]"
        onClick={() => run(onDuplicate)}
      >
        <Files className="h-4 w-4 text-[#555555]" />
        <span>Duplicate</span>
      </button>
    </div>
  );
}
