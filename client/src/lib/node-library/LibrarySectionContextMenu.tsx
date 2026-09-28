'use client';

import { ArrowDown, ArrowUp, TextCursorInput, Trash2 } from 'lucide-react';
import LibraryContextMenu from './LibraryContextMenu';

export interface LibrarySectionContextMenuProps {
  x: number;
  y: number;
  sectionName: string;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  trigger: HTMLButtonElement;
  onRename: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function LibrarySectionContextMenu({
  x,
  y,
  sectionName,
  disabled,
  canMoveUp,
  canMoveDown,
  trigger,
  onRename,
  onMove,
  onRemove,
  onClose,
}: LibrarySectionContextMenuProps) {
  return <LibraryContextMenu
    x={x}
    y={y}
    ariaLabel={`${sectionName} library actions`}
    trigger={trigger}
    onClose={onClose}
    items={[
      { key: 'rename', label: 'Rename library', icon: <TextCursorInput className="size-4 shrink-0 text-[#2196F3]" aria-hidden="true" />, disabled, onSelect: onRename },
      { key: 'move-up', label: 'Move up', icon: <ArrowUp className="size-4 shrink-0 text-[#555555]" aria-hidden="true" />, disabled: disabled || !canMoveUp, onSelect: () => onMove(-1) },
      { key: 'move-down', label: 'Move down', icon: <ArrowDown className="size-4 shrink-0 text-[#555555]" aria-hidden="true" />, disabled: disabled || !canMoveDown, onSelect: () => onMove(1) },
      { key: 'remove', label: 'Remove library', icon: <Trash2 className="size-4 shrink-0 text-[#E53935]" aria-hidden="true" />, disabled, separatorBefore: true, onSelect: onRemove },
    ]}
  />;
}
