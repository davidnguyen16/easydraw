'use client';

import { TextCursorInput, Trash2 } from 'lucide-react';
import LibraryContextMenu from './LibraryContextMenu';

export interface LibraryNodeContextMenuProps {
  x: number;
  y: number;
  nodeName: string;
  disabled: boolean;
  trigger: HTMLButtonElement;
  onRename: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function LibraryNodeContextMenu({ x, y, nodeName, disabled, trigger, onRename, onRemove, onClose }: LibraryNodeContextMenuProps) {
  return <LibraryContextMenu
    x={x}
    y={y}
    ariaLabel={`${nodeName} node actions`}
    trigger={trigger}
    onClose={onClose}
    items={[
      { key: 'rename', label: 'Rename node', icon: <TextCursorInput className="size-4 shrink-0 text-[#2196F3]" aria-hidden="true" />, disabled, onSelect: onRename },
      { key: 'remove', label: 'Remove node', icon: <Trash2 className="size-4 shrink-0 text-[#E53935]" aria-hidden="true" />, disabled, separatorBefore: true, onSelect: onRemove },
    ]}
  />;
}
