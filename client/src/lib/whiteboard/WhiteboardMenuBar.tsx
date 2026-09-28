'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Download, PenLine } from 'lucide-react';
import { accountInitials, useAuthStore } from '@/lib/stores/auth.store';
import { useWhiteboard } from './whiteboard.store';
import type { WhiteboardActions } from './actions';

export interface MenuItem {
  type?: 'divider';
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  onClick?: () => void;
}

/**
 * The maroon header, matching the diagram editor's MenuBar: logo back to the
 * workspace, editable title, document badge, menus, then save state, export
 * and the account avatar.
 */
export default function WhiteboardMenuBar({ actions }: { actions: WhiteboardActions }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const title = useWhiteboard((s) => s.title);
  const setTitle = useWhiteboard((s) => s.setTitle);
  const saveState = useWhiteboard((s) => s.saveState);
  const saveError = useWhiteboard((s) => s.saveError);
  const canUndo = useWhiteboard((s) => s.canUndo);
  const canRedo = useWhiteboard((s) => s.canRedo);
  const hasSelection = useWhiteboard((s) => s.hasSelection);
  const hasClipboard = useWhiteboard((s) => s.hasClipboard);
  const showGrid = useWhiteboard((s) => s.showGrid);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-menu-root]')) setOpenMenu(null);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [openMenu]);

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: 'New (clear board)', shortcut: 'Ctrl+N', onClick: actions.clear },
      { label: 'Open image…', shortcut: 'Ctrl+O', onClick: actions.openImage },
      { type: 'divider' },
      { label: 'Save as PNG', shortcut: 'Ctrl+S', onClick: () => actions.download('png') },
      { label: 'Save as JPEG', onClick: () => actions.download('jpeg') },
      { label: 'Print…', shortcut: 'Ctrl+P', onClick: actions.print },
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', disabled: !canUndo, onClick: actions.undo },
      { label: 'Redo', shortcut: 'Ctrl+Y', disabled: !canRedo, onClick: actions.redo },
      { type: 'divider' },
      { label: 'Cut', shortcut: 'Ctrl+X', disabled: !hasSelection, onClick: actions.cut },
      { label: 'Copy', shortcut: 'Ctrl+C', disabled: !hasSelection, onClick: actions.copy },
      { label: 'Paste', shortcut: 'Ctrl+V', disabled: !hasClipboard, onClick: actions.paste },
      { label: 'Paste from file…', shortcut: 'Ctrl+Alt+V', onClick: actions.pasteFromFile },
      { label: 'Duplicate', shortcut: 'Ctrl+D', disabled: !hasSelection, onClick: actions.duplicate },
      { label: 'Delete', shortcut: 'Del', disabled: !hasSelection, onClick: actions.deleteSelection },
      { type: 'divider' },
      { label: 'Select all', shortcut: 'Ctrl+A', onClick: actions.selectAll },
      { label: 'Invert colors', shortcut: 'Ctrl+I', onClick: actions.invert },
    ],
    Image: [
      { label: 'Crop or scale…', shortcut: 'Ctrl+E', onClick: actions.resize },
      { label: 'Crop to selection', disabled: !hasSelection, onClick: actions.crop },
      { type: 'divider' },
      { label: 'Rotate clockwise 90°', onClick: () => actions.rotate('cw') },
      { label: 'Rotate counterclockwise 90°', onClick: () => actions.rotate('ccw') },
      { label: 'Flip horizontal', onClick: () => actions.flip('horizontal') },
      { label: 'Flip vertical', onClick: () => actions.flip('vertical') },
      { type: 'divider' },
      { label: 'Clear…', danger: true, onClick: actions.clear },
    ],
    View: [
      { label: 'Zoom in', shortcut: 'Ctrl+Alt+=', onClick: actions.zoomIn },
      { label: 'Zoom out', shortcut: 'Ctrl+Alt+-', onClick: actions.zoomOut },
      { label: 'Zoom to 100%', shortcut: 'Ctrl+Alt+0', onClick: actions.zoomReset },
      { type: 'divider' },
      { label: 'Show gridlines', shortcut: 'Ctrl+G', checked: showGrid, onClick: actions.toggleGrid },
      { type: 'divider' },
      { label: 'Keyboard shortcuts', shortcut: '?', onClick: actions.shortcuts },
    ],
  };

  const status =
    saveState === 'saved'
      ? { label: 'All changes saved', tone: 'text-white/70' }
      : saveState === 'saving'
        ? { label: 'Saving…', tone: 'text-white/70' }
        : saveState === 'dirty'
          ? { label: 'Unsaved changes', tone: 'text-white/90' }
          : { label: 'Save failed', tone: 'text-amber-200' };

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-[0.4rem] bg-mq-maroon px-[0.85rem] text-white [font-family:system-ui,-apple-system,sans-serif]">
      <Link href="/dashboard/whiteboards" onNavigate={(event) => {
        event.preventDefault();
        void useWhiteboard.getState().flush().then((saved) => {
          if (saved) router.push('/dashboard/whiteboards');
        });
      }} title="Back to whiteboards" aria-label="Back to whiteboards" className="flex flex-shrink-0 items-center rounded-md p-1 transition-colors hover:bg-white/10">
        <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="40" height="40" rx="8" fill="#A6192E" />
          <rect x="12" y="12" width="12" height="8" rx="2" fill="white" opacity="0.95" />
          <rect x="28" y="28" width="12" height="8" rx="2" fill="white" opacity="0.95" />
          <path d="M24 16 L28 16 L28 32" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        </svg>
      </Link>
      <input
        className="min-w-[6rem] max-w-[18rem] rounded-[6px] border border-transparent bg-transparent px-2 py-1 text-[0.95rem] font-bold text-white transition-colors duration-150 hover:bg-white/[0.08] focus:border-white/40 focus:bg-white/[0.15] focus:outline-none"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Whiteboard title"
        placeholder="Untitled Whiteboard"
      />
      <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-black/[0.18] px-2.5 text-[0.78rem] font-semibold text-white/[0.92]">
        <PenLine size={12} aria-hidden="true" />
        Whiteboard
      </span>

      <nav className="ml-2 flex gap-[0.1rem]" data-menu-root>
        {Object.keys(menus).map((label) => (
          <div key={label} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={openMenu === label}
              onClick={() => setOpenMenu((open) => (open === label ? null : label))}
              onPointerEnter={() => openMenu && setOpenMenu(label)}
              className={`cursor-pointer rounded-[4px] border-none bg-transparent px-[0.7rem] py-[0.4rem] text-[0.9rem] text-white transition-colors duration-150 hover:bg-white/[0.18] focus-visible:outline-offset-1 focus-visible:[outline:2px_solid_rgba(255,255,255,0.6)] ${openMenu === label ? 'bg-white/[0.18]' : ''}`}
            >
              {label}
            </button>
            {openMenu === label && (
              <div role="menu" className="absolute top-[calc(100%+6px)] left-0 z-50 flex min-w-[250px] flex-col gap-px rounded-[10px] border border-line-dropdown bg-white p-1.5 text-[#2a2a2a] shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
                {menus[label]!.map((item, i) =>
                  item.type === 'divider' ? (
                    <div key={`d${i}`} className="mx-1 my-1 h-px bg-[#e8e5de]" role="separator" />
                  ) : (
                    <button
                      key={item.label}
                      type="button"
                      role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                      aria-checked={item.checked}
                      disabled={item.disabled}
                      onClick={() => {
                        setOpenMenu(null);
                        item.onClick?.();
                      }}
                      className={`group flex w-full cursor-pointer items-center gap-3 rounded-md border-none bg-transparent px-3 py-2 text-left text-[0.875rem] transition-colors duration-100 disabled:cursor-not-allowed disabled:text-[#b8b8b8] ${
                        item.danger ? 'text-[#b42318] enabled:hover:bg-[#fdf2f1]' : 'text-[#2a2a2a] enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon'
                      }`}
                    >
                      <span className="inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">{item.checked && <Check size={16} />}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && <span className="text-[0.78rem] tabular-nums text-ink-muted group-[:hover:not(:disabled)]:text-mq-red">{item.shortcut}</span>}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="flex-auto" />

      <span className={`text-[0.78rem] ${status.tone}`} title={saveError ?? undefined} aria-live="polite">
        {status.label}
      </span>
      {saveState === 'error' && <button type="button" className="rounded border border-white/40 px-2 py-1 text-sm hover:bg-white/10" onClick={() => void useWhiteboard.getState().flush()}>Retry save</button>}
      <button
        type="button"
        onClick={() => actions.download('png')}
        className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-white/25 bg-white/10 px-[14px] text-[0.9rem] font-semibold text-white transition-colors duration-[120ms] hover:bg-white/20"
      >
        <Download size={16} aria-hidden="true" />
        Export
      </button>
      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-mq-red-hover text-[0.75rem] font-bold tracking-[0.02em] text-white" title={user?.email ?? undefined}>
        {accountInitials(user)}
      </span>
    </header>
  );
}
