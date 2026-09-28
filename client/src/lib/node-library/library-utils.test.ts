import { describe, expect, it } from 'vitest';
import { filterLibraryNodes, moveItem, nodeDragPayload, reorderUpdates, validateCustomImageFile } from './library-utils';
import type { LibraryNode } from './api';

const robot: LibraryNode = { id: 'node-1', assetId: 'asset-1', name: 'Factory Robot', sectionId: 'factory', defaultWidth: 120, defaultHeight: 80, sortOrder: 0, asset: { id: 'asset-1', mimeType: 'image/png', width: 600, height: 400 } };

describe('custom library helpers', () => {
  it('accepts supported image files and bounds SVG separately', () => {
    expect(validateCustomImageFile({ name: 'robot.png', type: 'image/png', size: 100 })).toBeNull();
    expect(validateCustomImageFile({ name: 'robot.SVG', type: '', size: 100 })).toBeNull();
    expect(validateCustomImageFile({ name: 'robot.svg', type: 'image/svg+xml', size: 2 * 1024 * 1024 })).toContain('1 MB');
    expect(validateCustomImageFile({ name: 'robot.png', type: 'image/png', size: 11 * 1024 * 1024 })).toContain('10 MB');
    expect(validateCustomImageFile({ name: 'robot.js', type: 'text/javascript', size: 100 })).not.toBeNull();
    expect(validateCustomImageFile({ name: 'robot.png', type: 'text/html', size: 100 })).not.toBeNull();
    expect(validateCustomImageFile({ name: 'robot.png', type: 'image/png', size: 0 })).not.toBeNull();
  });

  it('creates an immutable drag snapshot without signed URLs or section changes', () => {
    const input = structuredClone(robot);
    const payload = nodeDragPayload(input);
    input.name = 'Renamed later';
    expect(payload).toEqual({ kind: 'custom-node', definitionId: 'node-1', assetId: 'asset-1', label: 'Factory Robot', intrinsicWidth: 600, intrinsicHeight: 400, defaultWidth: 120, defaultHeight: 80 });
    expect(JSON.stringify(payload)).not.toContain('url');
  });

  it('reorders a copy and safely handles ends or missing IDs', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(moveItem(items, 'b', -1).map((item) => item.id)).toEqual(['b', 'a', 'c']);
    expect(moveItem(items, 'b', 1).map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(moveItem(items, 'a', -1)).toEqual(items);
    expect(moveItem(items, 'missing', 1)).toEqual(items);
    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('searches custom names and expands matching library names', () => {
    expect(filterLibraryNodes([robot], 'ROBOT', 'Smart Factory')).toEqual([robot]);
    expect(filterLibraryNodes([robot], 'smart', 'Smart Factory')).toEqual([robot]);
    expect(filterLibraryNodes([robot], 'travel', 'Smart Factory')).toEqual([]);
  });

  it('only patches two records when priorities have gaps after deletions', () => {
    const items = [{ id: 'a', sortOrder: 20 }, { id: 'b', sortOrder: 30 }, { id: 'c', sortOrder: 50 }];
    expect(reorderUpdates(items, 'b', 1)).toEqual([{ id: 'b', sortOrder: 50 }, { id: 'c', sortOrder: 30 }]);
    expect(reorderUpdates(items, 'a', -1)).toEqual([]);
    expect(items[1].sortOrder).toBe(30);
  });
});
