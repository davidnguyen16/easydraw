'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Download, LayoutGrid, Settings as SettingsIcon, LogOut } from 'lucide-react';
import UiIcon from '@/lib/components/icons/UiIcon';
import KeyboardShortcutsModal from '@/lib/components/KeyboardShortcutsModal';
import { useEditor } from '@/lib/flow/EditorContext';
import { useEditorMeta, type DiagramStatus } from '@/lib/stores/editor-meta.store';
import { useVisibleUnsavedPageIds } from '@/lib/stores/editor-doc.store';
import { useAuthStore, accountInitials } from '@/lib/stores/auth.store';

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

const DOCUMENT_STATUSES: { id: DiagramStatus; label: string; color: string }[] = [
  { id: 'draft', label: 'Draft', color: '#f97316' },
  { id: 'complete', label: 'Complete', color: '#22c55e' },
  { id: 'archived', label: 'Archived', color: '#9ca3af' },
];

const menuLabels = ['File', 'Edit', 'View', 'Arrange', 'Help'];
const QUICK_EXPORT_ORDER = ['png', 'jpeg', 'pdf', 'easydraw'];

export default function MenuBar() {
  const editor = useEditor();
  const router = useRouter();

  const fileName = useEditorMeta((s) => s.fileName);
  const setFileName = useEditorMeta((s) => s.setFileName);
  const status = useEditorMeta((s) => s.status);
  const setStatus = useEditorMeta((s) => s.setStatus);

  // The editor sits behind the auth guard so user is populated; fallbacks are
  // just defensive.
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const accountName = user?.name ?? user?.email ?? 'Account';
  const accountEmail = user?.email ?? '';
  const hasNameAndEmail = !!(user?.name && user?.email);
  const userInitials = accountInitials(user);

  // Canvas dirtiness gives immediate feedback before the debounce runs;
  // saveStatus keeps the spinner alive through the debounce + PATCH.
  const unsavedPageIds = useVisibleUnsavedPageIds();
  const saving = editor.state.saveStatus === 'saving' || unsavedPageIds.length > 0;
  const saveFailed = editor.state.saveStatus === 'error';
  const currentDocumentStatus =
    DOCUMENT_STATUSES.find((s) => s.id === status) ?? DOCUMENT_STATUSES[0];

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [quickExportOpen, setQuickExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const closeMenus = useCallback(() => {
    setOpenMenu(null);
    setOpenSubmenu(null);
    setStatusMenuOpen(false);
    setUserMenuOpen(false);
    setQuickExportOpen(false);
  }, []);

  const toggleMenu = (label: string) => {
    setOpenMenu((prev) => (prev === label ? null : label));
    setOpenSubmenu(null);
    setStatusMenuOpen(false);
    setUserMenuOpen(false);
    setQuickExportOpen(false);
  };

  const toggleStatusMenu = () => {
    setOpenMenu(null);
    setOpenSubmenu(null);
    setStatusMenuOpen((v) => !v);
    setUserMenuOpen(false);
    setQuickExportOpen(false);
  };

  const toggleUserMenu = () => {
    setOpenMenu(null);
    setOpenSubmenu(null);
    setStatusMenuOpen(false);
    setUserMenuOpen((v) => !v);
    setQuickExportOpen(false);
  };

  const toggleQuickExport = () => {
    setOpenMenu(null);
    setOpenSubmenu(null);
    setStatusMenuOpen(false);
    setUserMenuOpen(false);
    setQuickExportOpen((v) => !v);
  };

  const selectStatus = (next: DiagramStatus) => {
    setStatus(next);
    setStatusMenuOpen(false);
  };

  const runItem = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.submenu) {
      setOpenSubmenu((prev) => (prev === item.label ? null : (item.label ?? null)));
      return;
    }
    if (!item.onClick) return;
    item.onClick();
    closeMenus();
  };

  const runQuickExport = (formatId: string) => {
    setQuickExportOpen(false);
    editor.exportAs(formatId);
  };

  const goToDashboard = () => {
    setUserMenuOpen(false);
    router.push('/dashboard');
  };

  const goToSettings = () => {
    setUserMenuOpen(false);
    router.push('/settings');
  };

  const signOut = async () => {
    setUserMenuOpen(false);
    await logout();
    router.push('/login');
  };

  // Outside click + Escape close any open dropdown / submenu.
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      // `data-*-root` DOM hooks survive the Tailwind migration — don't key this
      // on a styling class, those get renamed.
      if (
        target?.closest(
          '[data-menu-root], [data-status-root], [data-user-root], [data-quick-export-root]',
        )
      )
        return;
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
  }, [closeMenus]);

  // Export submenu built off the registry so new formats appear automatically.
  const exportSubmenu: MenuItem[] = editor.exportFormats.map((format) => ({
    label: `${format.label} (${format.extension})`,
    onClick: () => editor.exportAs(format.id),
  }));

  const quickExportFormats = editor.exportFormats
    .filter((format) => QUICK_EXPORT_ORDER.includes(format.id))
    .sort((a, b) => QUICK_EXPORT_ORDER.indexOf(a.id) - QUICK_EXPORT_ORDER.indexOf(b.id));

  // Rebuilt each render so disabled/checked state stays in sync with state/history.
  const menus: Record<string, MenuItem[]> = {
    File: [
      { icon: 'new', label: 'New', shortcut: 'Ctrl+N', onClick: editor.newFile },
      { icon: 'open', label: 'Open…', shortcut: 'Ctrl+O', onClick: editor.open },
      { icon: 'save', label: 'Save', shortcut: 'Ctrl+S', onClick: editor.save },
      { icon: 'save-as', label: 'Save As…', shortcut: 'Ctrl+Shift+S', onClick: editor.saveAs },
      { type: 'divider' },
      { icon: 'export', label: 'Export as', submenu: exportSubmenu },
    ],
    Edit: [
      {
        icon: 'undo',
        label: 'Undo',
        shortcut: 'Ctrl+Z',
        onClick: editor.undo,
        disabled: !editor.history.canUndo,
      },
      {
        icon: 'redo',
        label: 'Redo',
        shortcut: 'Ctrl+Y',
        onClick: editor.redo,
        disabled: !editor.history.canRedo,
      },
      { type: 'divider' },
      { icon: 'cut', label: 'Cut', shortcut: 'Ctrl+X', onClick: editor.cut },
      { icon: 'copy', label: 'Copy', shortcut: 'Ctrl+C', onClick: editor.copy },
      { icon: 'paste', label: 'Paste', shortcut: 'Ctrl+V', onClick: editor.paste },
      { icon: 'duplicate', label: 'Duplicate', shortcut: 'Ctrl+D', onClick: editor.duplicate },
      { type: 'divider' },
      { icon: 'select-all', label: 'Select all', shortcut: 'Ctrl+A', onClick: editor.selectAll },
      { type: 'divider' },
      {
        icon: 'delete',
        label: 'Delete',
        shortcut: 'Del',
        onClick: editor.deleteSelected,
        danger: true,
      },
    ],
    View: [
      {
        toggle: true,
        label: 'Show grid',
        checked: editor.state.showGrid,
        onClick: editor.toggleShowGrid,
      },
      {
        toggle: true,
        label: 'Snap to grid',
        checked: editor.state.snapToGrid,
        onClick: editor.toggleSnapToGrid,
      },
      { type: 'divider' },
      { icon: 'zoom-in', label: 'Zoom in', shortcut: 'Ctrl+=', onClick: editor.zoomIn },
      { icon: 'zoom-out', label: 'Zoom out', shortcut: 'Ctrl+-', onClick: editor.zoomOut },
      { icon: 'fit', label: 'Fit to screen', shortcut: 'Ctrl+Shift+H', onClick: editor.fitView },
    ],
    Arrange: [
      {
        icon: 'bring-front',
        label: 'Bring to front',
        shortcut: 'Ctrl+Shift+F',
        onClick: editor.bringToFront,
      },
      {
        icon: 'send-back',
        label: 'Send to back',
        shortcut: 'Ctrl+Shift+B',
        onClick: editor.sendToBack,
      },
      { type: 'divider' },
      { icon: 'group', label: 'Group', shortcut: 'Ctrl+G', onClick: editor.group },
      { icon: 'ungroup', label: 'Ungroup', shortcut: 'Ctrl+Shift+G', onClick: editor.ungroup },
    ],
    Help: [
      {
        icon: 'info',
        label: 'About EasyDraw',
        // Open the public landing; the user stays logged in.
        onClick: () => router.push('/'),
      },
      {
        icon: 'keyboard',
        label: 'Keyboard shortcuts',
        shortcut: 'Ctrl+/',
        onClick: () => setShortcutsOpen(true),
      },
    ],
  };

  return (
    <>
      <header
        className="flex h-[52px] items-center gap-[0.4rem] bg-mq-maroon px-[0.85rem] text-white
          [font-family:system-ui,-apple-system,sans-serif]"
      >
        <Link
          href="/dashboard"
          title="Back to dashboard"
          aria-label="Back to dashboard"
          className="flex flex-shrink-0 items-center rounded-md p-1 transition-colors hover:bg-white/10"
        >
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect x="4" y="4" width="40" height="40" rx="8" fill="#A6192E" />
            <rect x="12" y="12" width="12" height="8" rx="2" fill="white" opacity="0.95" />
            <rect x="28" y="28" width="12" height="8" rx="2" fill="white" opacity="0.95" />
            <path
              d="M24 16 L28 16 L28 32"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.8"
            />
          </svg>
        </Link>

        <input
          className="min-w-[6rem] max-w-[18rem] rounded-[6px] border border-transparent bg-transparent
            px-2 py-1 text-[0.95rem] font-bold text-white transition-colors duration-150
            hover:bg-white/[0.08] focus:border-white/40 focus:bg-white/[0.15] focus:outline-none"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          aria-label="Document file name"
          placeholder="Untitled"
        />

        <div className="relative flex-shrink-0" data-status-root>
          <button
            type="button"
            className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-full border-none
              bg-black/[0.18] px-2.5 text-[0.78rem] font-semibold text-white/[0.92]
              transition-colors duration-150 hover:bg-white/[0.18]
              focus-visible:outline-offset-1 focus-visible:[outline:2px_solid_rgba(255,255,255,0.6)]"
            aria-label="Document status"
            aria-haspopup="menu"
            aria-expanded={statusMenuOpen}
            onClick={toggleStatusMenu}
          >
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ backgroundColor: currentDocumentStatus.color }}
            />
            <span>{currentDocumentStatus.label}</span>
          </button>

          {statusMenuOpen && (
            <div
              className="absolute top-[calc(100%+10px)] left-1/2 z-50 flex w-[220px] -translate-x-1/2
                flex-col gap-px rounded-[10px] border border-line-dropdown bg-white p-1.5
                text-[#2a2a2a] shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
              role="menu"
              aria-label="Document status"
            >
              <span
                className="absolute top-[-6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45
                  border-t border-l border-line-dropdown bg-white"
                aria-hidden="true"
              />
              {DOCUMENT_STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={status === s.id}
                  className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-md
                    border-none bg-transparent px-3 py-2 text-left text-[0.875rem] text-[#2a2a2a]
                    transition-colors duration-100 enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon
                    [&.active]:bg-mq-pink [&.active]:text-mq-maroon ${status === s.id ? 'active' : ''}`}
                  onClick={() => selectStatus(s.id)}
                >
                  <span
                    className="h-[9px] w-[9px] flex-shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="flex-1">{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="ml-2 flex gap-[0.1rem]" data-menu-root>
          {menuLabels.map((label) => (
            <div key={label} className="relative">
              <button
                className={`cursor-pointer rounded-[4px] border-none bg-transparent px-[0.7rem]
                  py-[0.4rem] text-[0.9rem] text-white transition-colors duration-150
                  hover:bg-white/[0.18]
                  focus-visible:outline-offset-1 focus-visible:[outline:2px_solid_rgba(255,255,255,0.6)]
                  [&.active]:bg-white/[0.18] ${openMenu === label ? 'active' : ''}`}
                type="button"
                aria-haspopup="menu"
                aria-expanded={openMenu === label}
                onClick={() => toggleMenu(label)}
              >
                {label}
              </button>
              {openMenu === label && (
                <div
                  className="absolute top-[calc(100%+6px)] left-0 z-50 flex min-w-[240px] flex-col
                    gap-px rounded-[10px] border border-line-dropdown bg-white p-1.5 text-[#2a2a2a]
                    shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
                  role="menu"
                >
                  {menus[label].map((item, i) =>
                    item.type === 'divider' ? (
                      <div key={`d${i}`} className="mx-1 my-1 h-px bg-[#e8e5de]" role="separator" />
                    ) : (
                      <div key={item.label} className="relative flex flex-col">
                        <button
                          type="button"
                          role="menuitem"
                          className={`group flex w-full cursor-pointer items-center gap-3 rounded-md
                            border-none bg-transparent px-3 py-2 text-left text-[0.875rem] text-[#2a2a2a]
                            transition-colors duration-100 enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon
                            disabled:cursor-not-allowed disabled:text-[#b8b8b8]
                            [&.active:not(:disabled)]:bg-mq-pink [&.active:not(:disabled)]:text-mq-maroon
                            [&.danger]:text-[#b42318]
                            [&.danger:not(:disabled)]:hover:bg-[#fdf2f1]
                            [&.danger:not(:disabled)]:hover:text-[#b42318]
                            ${item.danger ? 'danger' : ''}
                            ${item.submenu && openSubmenu === item.label ? 'active' : ''}`}
                          disabled={item.disabled}
                          onClick={() => runItem(item)}
                        >
                          <span
                            className="inline-flex h-[18px] w-[18px] flex-shrink-0 items-center
                              justify-center text-[#5a5c58]
                              group-[:hover:not(:disabled)]:text-mq-maroon
                              group-[.active:not(:disabled)]:text-mq-maroon
                              group-[.danger]:text-[#b42318] group-disabled:text-[#c8c8c8]"
                          >
                            {item.toggle
                              ? item.checked && <UiIcon name="check" className="h-4 w-4" />
                              : item.icon && <UiIcon name={item.icon} className="h-4 w-4" />}
                          </span>
                          <span className="flex-1">{item.label}</span>
                          {item.shortcut ? (
                            <span
                              className="text-[0.78rem] tabular-nums text-ink-muted
                                group-[:hover:not(:disabled)]:text-mq-red
                                group-[.active:not(:disabled)]:text-mq-red"
                            >
                              {item.shortcut}
                            </span>
                          ) : (
                            item.submenu && (
                              <span className="inline-flex h-3.5 w-3.5 text-ink-muted [&_svg]:size-3.5">
                                <UiIcon name="chevron-right" className="h-4 w-4" />
                              </span>
                            )
                          )}
                        </button>
                        {item.submenu && openSubmenu === item.label && (
                          <div
                            className="absolute top-[-6px] left-[calc(100%+4px)] z-50 flex min-w-[180px]
                              flex-col gap-px rounded-[10px] border border-line-dropdown bg-white p-1.5
                              text-[#2a2a2a] shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
                            role="menu"
                          >
                            {item.submenu.map((sub) => (
                              <button
                                key={sub.label}
                                type="button"
                                role="menuitem"
                                className="group flex w-full cursor-pointer items-center gap-3 rounded-md
                                  border-none bg-transparent px-3 py-2 text-left text-[0.875rem]
                                  text-[#2a2a2a] transition-colors duration-100
                                  enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon
                                  disabled:cursor-not-allowed disabled:text-[#b8b8b8]"
                                disabled={sub.disabled}
                                onClick={() => runItem(sub)}
                              >
                                <span className="inline-flex h-[18px] w-[18px] flex-shrink-0" />
                                <span className="flex-1">{sub.label}</span>
                                {sub.shortcut && (
                                  <span
                                    className="text-[0.78rem] tabular-nums text-ink-muted
                                      group-[:hover:not(:disabled)]:text-mq-red"
                                  >
                                    {sub.shortcut}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="flex-auto" />

        <div className="flex flex-shrink-0 items-center gap-2">
          {/* Save status follows the debounced PATCH lifecycle. Click to force a
              save or retry after an error. */}
          <button
            type="button"
            className="mb-tip relative inline-flex h-8 w-8 cursor-pointer items-center justify-center
              rounded-[7px] border-none bg-transparent text-white/[0.92] transition-colors
              duration-[120ms] hover:bg-white/[0.16]"
            aria-label={saving ? 'Saving…' : saveFailed ? 'Save failed. Click to retry' : 'Saved'}
            onClick={editor.save}
          >
            {saving ? (
              <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px] animate-spin"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            ) : saveFailed ? (
              <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px] text-red-200"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 15.3" />
                <path d="m9.5 12 5 5" />
                <path d="m14.5 12-5 5" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 15.3" />
                <path d="m8.5 13.5 2.5 2.5 4.5-4.5" />
              </svg>
            )}
          </button>

          <div className="relative flex-shrink-0" data-user-root>
            <button
              type="button"
              className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full
                border-none bg-mq-red-hover text-[0.75rem] font-bold tracking-[0.02em] text-white
                transition-colors duration-[120ms] hover:bg-mq-maroon
                focus-visible:outline-offset-1 focus-visible:[outline:2px_solid_rgba(255,255,255,0.6)]"
              title={accountName}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              onClick={toggleUserMenu}
            >
              {userInitials}
            </button>

            {userMenuOpen && (
              <div
                className="absolute top-[calc(100%+8px)] right-0 z-50 flex w-56 flex-col rounded-[10px]
                  border border-line-dropdown bg-white p-1.5 text-[#2a2a2a]
                  shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
                role="menu"
                aria-label="Account"
              >
                <div className="px-2.5 py-1.5">
                  <p className="text-[0.72rem] text-ink-muted">Signed in as</p>
                  <p className="truncate text-[0.875rem] font-medium text-[#2a2a2a]">{accountName}</p>
                  {hasNameAndEmail && (
                    <p className="truncate text-[0.72rem] text-ink-muted">{accountEmail}</p>
                  )}
                </div>

                <div className="mx-1 my-1 h-px bg-[#e8e5de]" role="separator" />

                <button
                  type="button"
                  role="menuitem"
                  className="group flex w-full cursor-pointer items-center gap-2.5 rounded-md
                    border-none bg-transparent px-2.5 py-2 text-left text-[0.875rem] text-[#2a2a2a]
                    transition-colors duration-100 enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon"
                  onClick={goToDashboard}
                >
                  <LayoutGrid size={15} className="flex-shrink-0 text-[#5a5c58] group-hover:text-mq-maroon" />
                  My diagrams
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="group flex w-full cursor-pointer items-center gap-2.5 rounded-md
                    border-none bg-transparent px-2.5 py-2 text-left text-[0.875rem] text-[#2a2a2a]
                    transition-colors duration-100 enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon"
                  onClick={goToSettings}
                >
                  <SettingsIcon size={15} className="flex-shrink-0 text-[#5a5c58] group-hover:text-mq-maroon" />
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="group flex w-full cursor-pointer items-center gap-2.5 rounded-md
                    border-none bg-transparent px-2.5 py-2 text-left text-[0.875rem] text-[#2a2a2a]
                    transition-colors duration-100 enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon"
                  onClick={signOut}
                >
                  <LogOut size={15} className="flex-shrink-0 text-[#5a5c58] group-hover:text-mq-maroon" />
                  Sign out
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[8px]
              border-none bg-mq-red px-[18px] text-[0.95rem] font-semibold text-white transition-colors
              duration-[120ms] hover:bg-mq-red-hover"
            onClick={editor.present}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[19px] w-[19px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            Present
          </button>

          <div className="relative flex-shrink-0" data-quick-export-root>
            <button
              type="button"
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[8px]
                border border-white/25 bg-white/10 px-3 text-[0.9rem] font-semibold text-white
                transition-colors duration-[120ms] hover:bg-white/[0.18]"
              aria-label="Export diagram"
              aria-haspopup="menu"
              aria-expanded={quickExportOpen}
              onClick={toggleQuickExport}
            >
              <Download size={17} />
              Export
              <ChevronDown
                size={14}
                className={`transition-transform duration-150 ${quickExportOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {quickExportOpen && (
              <div
                className="absolute top-[calc(100%+8px)] right-0 z-50 flex min-w-[180px] flex-col
                  gap-px rounded-[10px] border border-line-dropdown bg-white p-1.5 text-[#2a2a2a]
                  shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
                role="menu"
                aria-label="Export diagram"
              >
                {quickExportFormats.map((format) => (
                  <button
                    key={format.id}
                    type="button"
                    role="menuitem"
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-md
                      border-none bg-transparent px-3 py-2 text-left text-[0.875rem] text-[#2a2a2a]
                      transition-colors duration-100 enabled:hover:bg-mq-pink enabled:hover:text-mq-maroon"
                    onClick={() => runQuickExport(format.id)}
                  >
                    <Download size={15} className="flex-shrink-0 text-[#5a5c58] group-hover:text-mq-maroon" />
                    <span className="flex-1">{format.label}</span>
                    <span className="text-[0.75rem] text-ink-muted">{format.extension}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
