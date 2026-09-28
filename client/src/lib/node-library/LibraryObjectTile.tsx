'use client';

import { Box } from 'lucide-react';
import { dndState } from '@/lib/flow/dnd';
import type { Object3DTemplate } from '@/lib/diagram3d/object-library';

export interface TileMenuPosition {
  x: number;
  y: number;
  trigger: HTMLButtonElement;
}

/**
 * A saved 3D object in a private library, next to the image tiles. Dropping
 * it on the 2D canvas or the 3D scene creates a node carrying the recipe at
 * the size the object was saved with. The thumbnail is rendered locally
 * from the recipe; there is no remote image.
 */
export default function LibraryObjectTile({ template, thumbnail, disabled, onOpenMenu }: {
  template: Object3DTemplate;
  thumbnail: string | undefined;
  disabled: boolean;
  onOpenMenu: (position: TileMenuPosition) => void;
}) {
  const openMenu = (trigger: HTMLButtonElement, x?: number, y?: number) => {
    const bounds = trigger.getBoundingClientRect();
    onOpenMenu({ x: x || bounds.left, y: y || bounds.bottom, trigger });
  };
  return (
    <button
      type="button"
      className="flex aspect-square min-w-0 cursor-grab flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border border-[#e8e2d3] bg-white p-1 text-ink-soft transition-[border-color,box-shadow] duration-150 hover:border-mq-red hover:shadow-[0_1px_4px_rgba(166,25,46,0.15)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mq-red active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
      aria-label={`Drag ${template.name} to canvas`}
      aria-haspopup="menu"
      title={`${template.name} — drag to the canvas or the 3D scene; right-click to rename, download or remove`}
      draggable={!disabled}
      disabled={disabled}
      data-library-object
      onDragStart={(event) => {
        dndState.current = { kind: 'object-3d', name: template.name, recipe: template.recipe };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', template.name);
      }}
      onDragEnd={() => { dndState.current = null; }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu(event.currentTarget, event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
        event.preventDefault();
        event.stopPropagation();
        openMenu(event.currentTarget);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {thumbnail ? <img src={thumbnail} alt="" draggable={false} className="size-full min-h-0 min-w-0 object-contain" /> : <Box size={18} strokeWidth={1.6} className="text-mq-red/70" aria-hidden="true" />}
    </button>
  );
}
