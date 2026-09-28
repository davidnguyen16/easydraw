'use client';

import { Download, TextCursorInput, Trash2 } from 'lucide-react';
import LibraryContextMenu from './LibraryContextMenu';

export interface LibraryObjectContextMenuProps {
  x: number;
  y: number;
  objectName: string;
  disabled: boolean;
  trigger: HTMLButtonElement;
  onRename: () => void;
  onDownload: () => void;
  onRemove: () => void;
  onClose: () => void;
}

/** Right-click menu of a 3D object tile: the node menu plus a JSON download, since objects travel as files. */
export default function LibraryObjectContextMenu({ x, y, objectName, disabled, trigger, onRename, onDownload, onRemove, onClose }: LibraryObjectContextMenuProps) {
  return <LibraryContextMenu
    x={x}
    y={y}
    ariaLabel={`${objectName} 3D object actions`}
    trigger={trigger}
    onClose={onClose}
    items={[
      { key: 'rename', label: 'Rename object', icon: <TextCursorInput className="size-4 shrink-0 text-[#2196F3]" aria-hidden="true" />, disabled, onSelect: onRename },
      { key: 'download', label: 'Download JSON', icon: <Download className="size-4 shrink-0 text-[#555555]" aria-hidden="true" />, onSelect: onDownload },
      { key: 'remove', label: 'Remove object', icon: <Trash2 className="size-4 shrink-0 text-[#E53935]" aria-hidden="true" />, disabled, separatorBefore: true, onSelect: onRemove },
    ]}
  />;
}
