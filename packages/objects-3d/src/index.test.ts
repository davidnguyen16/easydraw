import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync } from 'node:fs';
import { validateVisual3DRecipe } from '@easydraw/diagram-schema';
import { OBJECTS_3D, getObject3D } from './index.js';

describe('objects-3d starter set', () => {
  it('ships every recipe file, all valid, with unique ids', () => {
    const files = readdirSync(new URL('../../recipes', import.meta.url)).filter((f) => f.endsWith('.json'));
    assert.equal(OBJECTS_3D.length, files.length, 'every recipes/*.json is imported in src/index.ts');
    assert.equal(new Set(OBJECTS_3D.map((o) => o.id)).size, OBJECTS_3D.length);
    for (const object of OBJECTS_3D) {
      const result = validateVisual3DRecipe(object.recipe);
      assert.ok(result.valid, `${object.id}: ${result.issues.map((i) => i.message).join(' ')}`);
      assert.ok(object.recipe.size && object.recipe.fill, `${object.id} has a drop size and default fill`);
    }
  });

  it('keeps every part reasonably inside its box so objects sit on their footprint', () => {
    for (const object of OBJECTS_3D) {
      for (const part of object.recipe.parts) {
        for (let axis = 0; axis < 3; axis += 1) {
          const extent = Math.abs(part.position[axis]!) + part.size[axis]! / 2;
          assert.ok(extent <= 1.3, `${object.id} part overhangs on axis ${axis}: ${extent}`);
        }
      }
    }
  });

  it('looks objects up by id', () => {
    assert.equal(getObject3D('rack')?.name, 'Server rack');
    assert.equal(getObject3D('nope'), undefined);
  });
});
