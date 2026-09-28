import { describe, expect, it } from 'vitest';
import type { Visual3DRecipe } from '@easydraw/diagram-schema';
import { duplicateNotice, findDuplicate, recipeSignature } from './duplicate-object';
import type { Object3DTemplate } from './object-library';

const box = (size: number): Visual3DRecipe => ({
  version: 2,
  parts: [{ shape: 'box', material: 'custom', color: '#a6192e', size: [size, size, size], position: [0, 0, 0] }],
});

const template = (name: string, recipe: Visual3DRecipe, sectionId = 'lib-1'): Object3DTemplate =>
  ({ id: `id-${name}`, sectionId, name, recipe, updatedAt: '2026-09-24T00:00:00.000Z' });

const library = [template('Server rack', box(0.3)), template('Desk', box(0.5), 'lib-2')];

describe('recipeSignature', () => {
  it('ignores key order, so a recipe that went through jsonb still matches its file', () => {
    const fromFile = box(0.3);
    // Postgres jsonb reorders object keys; rebuild a part that way.
    const fromDatabase = { version: 2, parts: [{ size: [0.3, 0.3, 0.3], color: '#A6192E', shape: 'box', position: [0, 0, 0], material: 'custom' }] } as Visual3DRecipe;
    expect(recipeSignature(fromDatabase)).toBe(recipeSignature(fromFile));
  });

  it('separates recipes that really differ', () => {
    expect(recipeSignature(box(0.3))).not.toBe(recipeSignature(box(0.4)));
  });
});

describe('findDuplicate', () => {
  it('finds nothing in an empty or unrelated library', () => {
    expect(findDuplicate(null, 'Rack', box(0.3))).toBeNull();
    expect(findDuplicate([], 'Rack', box(0.3))).toBeNull();
    expect(findDuplicate([template('Desk', box(0.5))], 'Rack', box(0.9))).toBeNull();
  });

  it('flags the same name and the same shape as already uploaded', () => {
    const match = findDuplicate(library, '  server RACK ', box(0.3));
    expect(match?.identical).toBe(true);
    expect(match?.template.name).toBe('Server rack');
  });

  it('lets the same shape under another name through, and still reports it', () => {
    const match = findDuplicate(library, 'Rack copy', box(0.3));
    expect(match?.identical).toBe(false);
    expect(match?.sameShape).toBe(true);
    expect(duplicateNotice(match!, 'Data centre', 'Rack copy'))
      .toBe('Added "Rack copy". It has the same shape as "Server rack" in Data centre.');
  });

  it('reports a name clash between different shapes without blocking', () => {
    const match = findDuplicate(library, 'Desk', box(0.9));
    expect(match?.identical).toBe(false);
    expect(match?.sameName).toBe(true);
    expect(duplicateNotice(match!, 'Office', 'Desk'))
      .toBe('Added "Desk". Office already has a different object with that name.');
  });

  it('prefers an exact match over a weaker one', () => {
    const shapeOnly = template('Something else', box(0.3), 'lib-3');
    const match = findDuplicate([shapeOnly, ...library], 'Server rack', box(0.3));
    expect(match?.identical).toBe(true);
    expect(match?.template.name).toBe('Server rack');
  });
});
