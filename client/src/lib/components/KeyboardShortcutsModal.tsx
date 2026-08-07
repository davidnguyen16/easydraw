'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

// Reference sheet opened from Help → Keyboard shortcuts. Mirrors the shortcuts
// registered in keyboard-shortcuts.ts.
const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'General',
    items: [
      ['Undo', 'Ctrl+Z'],
      ['Redo', 'Ctrl+Y'],
      ['Save', 'Ctrl+S'],
      ['Select all', 'Ctrl+A'],
    ],
  },
  {
    title: 'Edit',
    items: [
      ['Copy', 'Ctrl+C'],
      ['Cut', 'Ctrl+X'],
      ['Paste', 'Ctrl+V'],
      ['Duplicate', 'Ctrl+D'],
      ['Delete', 'Del'],
    ],
  },
  {
    title: 'Format',
    items: [
      ['Bold', 'Ctrl+B'],
      ['Italic', 'Ctrl+I'],
      ['Underline', 'Ctrl+U'],
    ],
  },
  {
    title: 'Arrange',
    items: [
      ['Bring to front', 'Ctrl+Shift+F'],
      ['Send to back', 'Ctrl+Shift+B'],
      ['Group', 'Ctrl+G'],
      ['Ungroup', 'Ctrl+Shift+G'],
    ],
  },
  {
    title: 'View',
    items: [
      ['Zoom in', 'Ctrl+='],
      ['Zoom out', 'Ctrl+-'],
      ['Fit to screen', 'Ctrl+Shift+H'],
    ],
  },
];

export default function KeyboardShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/45 p-6"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[calc(100vh-64px)] w-[560px] max-w-full flex-col overflow-hidden
          rounded-xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line-soft px-5 py-4">
          <h2 className="m-0 text-[1.15rem] font-semibold text-ink">Keyboard shortcuts</h2>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center rounded-md border-none
              bg-transparent p-1 text-ink-soft transition-colors hover:bg-surface-hover hover:text-ink"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-x-8 gap-y-5 overflow-y-auto p-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">
                {g.title.toUpperCase()}
              </h3>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {g.items.map(([label, keys]) => (
                  <li
                    key={label}
                    className="flex items-center justify-between text-[0.85rem] text-ink-soft"
                  >
                    <span>{label}</span>
                    <kbd
                      className="rounded border border-line bg-panel px-1.5 py-0.5 text-[0.72rem]
                        tabular-nums text-ink-muted"
                    >
                      {keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
