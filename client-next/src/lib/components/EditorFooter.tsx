'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X, Layers, Menu, Check } from 'lucide-react';
import { useEditorDoc, useVisibleUnsavedPageIds } from '@/lib/stores/editor-doc.store';
import { useFlowStore } from '@/lib/flow/flow-store';
import { ANCHOR_NODE_TYPE } from '@/lib/flow/nodes/anchor/anchor';
import {
  handleSwitchPage,
  handleCreatePage,
  handleDeletePage,
  handleDuplicatePage,
  handleDeleteAllPages,
  handleRenamePage,
} from '@/lib/flow/editor-persistence';
import PageTabContextMenu from './PageTabContextMenu';

export default function EditorFooter() {
  const pages = useEditorDoc((s) => s.pages);
  const activePageId = useEditorDoc((s) => s.activePageId);
  const unsaved = useVisibleUnsavedPageIds();
  // Footer "shapes" counter — real diagram nodes only (anchors are internal).
  const nodeCount = useFlowStore((s) => s.nodes.filter((n) => n.type !== ANCHOR_NODE_TYPE).length);

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    x: number;
    anchorTop: number;
  } | null>(null);
  const hamburgerRef = useRef<HTMLDivElement>(null);

  // Close the hamburger dropdown on a click outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (hamburgerRef.current && !hamburgerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [menuOpen]);

  const switchTo = (pageId: string) => {
    setMenuOpen(false);
    setContextMenu(null);
    handleSwitchPage(pageId);
  };

  const addPage = () => {
    setMenuOpen(false);
    setContextMenu(null);
    handleCreatePage();
  };

  const removePage = (pageId: string) => {
    setContextMenu(null);
    handleDeletePage(pageId);
  };

  const deleteAll = () => {
    setMenuOpen(false);
    handleDeleteAllPages();
  };

  const startRename = (pageId: string, currentName: string) => {
    setMenuOpen(false);
    setContextMenu(null);
    setEditValue(currentName);
    setEditingPageId(pageId);
  };

  const commitRename = () => {
    if (editingPageId) handleRenamePage(editingPageId, editValue.trim() || 'Page');
    setEditingPageId(null);
  };

  const openContextMenu = (event: React.MouseEvent, pageId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(false);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ pageId, x: rect.left, anchorTop: rect.top });
  };

  return (
    <footer
      className="flex h-9 flex-shrink-0 items-stretch justify-between border-t border-[#E0E0E0] bg-[#FAFAFA] select-none"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {/* Hamburger menu + page tabs (left) */}
      <div className="flex min-w-0 flex-1 items-stretch">
        <div className="relative flex flex-shrink-0 items-center" ref={hamburgerRef}>
          <button
            type="button"
            className="flex h-full w-9 items-center justify-center border-r border-[#E0E0E0] text-[#404040] transition-colors hover:bg-[#F0F0F0]"
            title="Page menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Menu className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute bottom-full left-0 z-50 mb-1 w-44 rounded border border-[#D4D4D4] bg-[#F4F4F4] py-1 shadow-lg"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center px-3 py-1.5 text-left text-xs text-[#333333] hover:bg-[#E0E0E0]"
                onClick={addPage}
              >
                Insert Page
              </button>
              <div className="my-1 h-px bg-[#D4D4D4]" />
              <div className="max-h-56 overflow-y-auto">
                {pages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center px-3 py-1.5 text-left text-xs text-[#333333] hover:bg-[#E0E0E0]"
                    onClick={() => switchTo(page.id)}
                  >
                    <span className="flex w-4 flex-shrink-0 items-center">
                      {activePageId === page.id && <Check className="h-3.5 w-3.5 text-[#1A1A1A]" />}
                    </span>
                    <span className="truncate">{page.name}</span>
                  </button>
                ))}
              </div>
              <div className="my-1 h-px bg-[#D4D4D4]" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center px-3 py-1.5 text-left text-xs text-[#333333] hover:bg-[#E0E0E0]"
                onClick={deleteAll}
              >
                Delete All
              </button>
            </div>
          )}
        </div>

        {/* Page tabs */}
        <div className="flex h-full min-w-0 flex-1 items-stretch overflow-x-auto">
          {pages.map((page) => {
            const isActive = activePageId === page.id;
            const isEditing = editingPageId === page.id;
            return (
              <div
                key={page.id}
                className={`group relative flex min-w-[104px] flex-shrink-0 cursor-pointer items-center justify-center border-r border-[#E0E0E0] px-7 transition-colors ${
                  isActive ? 'bg-white' : 'hover:bg-[#F0F0F0]'
                }`}
                role="tab"
                tabIndex={-1}
                aria-selected={isActive}
                onClick={() => !isEditing && switchTo(page.id)}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  startRename(page.id, page.name);
                }}
                onContextMenu={(event) => openContextMenu(event, page.id)}
              >
                {isActive && <div className="absolute top-0 right-0 left-0 h-[2px] bg-mq-red" />}

                {isEditing ? (
                  <input
                    ref={(el) => {
                      if (el) {
                        el.focus();
                        el.select();
                      }
                    }}
                    className="h-full w-24 bg-white px-3 text-center text-xs outline-none"
                    value={editValue}
                    onInput={(event) => setEditValue(event.currentTarget.value)}
                    onBlur={commitRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitRename();
                      if (event.key === 'Escape') setEditingPageId(null);
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="max-w-[120px] truncate text-center text-xs font-medium text-[#2C2C2A]">
                      {page.name}
                    </span>
                    {pages.length > 1 && (
                      <button
                        type="button"
                        className="absolute right-1.5 rounded p-0.5 opacity-0 transition-all hover:bg-mq-red/15 group-hover:opacity-100"
                        aria-label="Delete page"
                        onClick={(event) => {
                          event.stopPropagation();
                          removePage(page.id);
                        }}
                      >
                        <X className="h-3 w-3 text-[#6B6B6B]" />
                      </button>
                    )}
                    {unsaved.includes(page.id) && (
                      <span
                        className="pointer-events-none absolute top-1 right-1 size-[7px] rounded-full bg-[#d6001c]"
                        title="Unsaved changes"
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}

          <button
            type="button"
            className="mx-1.5 flex w-7 flex-shrink-0 items-center justify-center rounded text-[#6B6B6B] transition-colors hover:bg-[#F0F0F0] hover:text-mq-red"
            title="Add page"
            aria-label="Add page"
            onClick={addPage}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Shape count (right) */}
      <div className="flex items-center gap-1.5 border-l border-[#E0E0E0] bg-white px-3">
        <Layers className="h-3.5 w-3.5 text-mq-red" />
        <span className="text-xs font-semibold text-[#2C2C2A] tabular-nums">{nodeCount}</span>
        <span className="text-xs text-[#6B6B6B]">shapes</span>
      </div>

      {contextMenu && (
        <PageTabContextMenu
          x={contextMenu.x}
          anchorTop={contextMenu.anchorTop}
          canDelete={pages.length > 1}
          onInsert={addPage}
          onDelete={() => removePage(contextMenu.pageId)}
          onRename={() =>
            startRename(
              contextMenu.pageId,
              pages.find((p) => p.id === contextMenu.pageId)?.name ?? '',
            )
          }
          onDuplicate={() => handleDuplicatePage(contextMenu.pageId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </footer>
  );
}
