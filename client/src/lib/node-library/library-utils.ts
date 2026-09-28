import type { CustomNodeDragPayload } from '@/lib/flow/dnd';
import type { LibraryNode } from './api';

export const CUSTOM_IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml';
export const MAX_CUSTOM_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateCustomImageFile(file: Pick<File, 'size' | 'name' | 'type'>): string | null {
  if (file.size <= 0) return 'The file is empty.';
  if (file.size > MAX_CUSTOM_UPLOAD_BYTES) return 'Choose an image smaller than 10 MB.';
  if (/\.svg$/i.test(file.name) && file.size > 1024 * 1024) return 'Choose a static SVG smaller than 1 MB.';
  if (!/\.(png|jpe?g|webp|svg)$/i.test(file.name)) return 'Choose PNG, JPG, WebP or a static SVG image.';
  if (file.type && !['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) return 'This image format is not supported.';
  return null;
}

export function nodeDragPayload(node: LibraryNode): CustomNodeDragPayload {
  return {
    kind: 'custom-node', definitionId: node.id, assetId: node.assetId, label: node.name,
    intrinsicWidth: node.asset.width, intrinsicHeight: node.asset.height,
    defaultWidth: node.defaultWidth, defaultHeight: node.defaultHeight,
  };
}

export function moveItem<T extends { id: string }>(items: readonly T[], id: string, direction: -1 | 1): T[] {
  const next = [...items];
  const index = next.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Normal ordering swaps two priorities, so deleted gaps do not cause N API writes. */
export function reorderUpdates<T extends { id: string; sortOrder: number }>(items: readonly T[], id: string, direction: -1 | 1): Array<{ id: string; sortOrder: number }> {
  const index = items.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return [];
  const item = items[index];
  const neighbor = items[target];
  if (item.sortOrder !== neighbor.sortOrder) return [{ id: item.id, sortOrder: neighbor.sortOrder }, { id: neighbor.id, sortOrder: item.sortOrder }];
  // A previous interrupted reorder can leave ties. Reindex once to repair them.
  return moveItem(items, id, direction).flatMap((entry, position) => entry.sortOrder === position ? [] : [{ id: entry.id, sortOrder: position }]);
}

export function filterLibraryNodes(nodes: readonly LibraryNode[], query: string, sectionName: string): readonly LibraryNode[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized || sectionName.toLocaleLowerCase().includes(normalized)) return nodes;
  return nodes.filter((node) => node.name.toLocaleLowerCase().includes(normalized));
}
