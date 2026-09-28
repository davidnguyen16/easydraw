import assert from 'node:assert/strict';
import test from 'node:test';
import { isVisual3DRecipe, validateVisual3DRecipe, MAX_VISUAL3D_PARTS, cloneVisual3DPart, type Visual3DPart } from './index.js';

const part: Visual3DPart = { shape: 'cylinder', material: 'body', size: [0.43, 0.38, 0.43], position: [0, -0.31, 0], taper: 0.71 };

test('a recipe is a part list, optionally with a drop size and default fill', () => {
  assert.equal(isVisual3DRecipe({ version: 2, parts: [part] }), true);
  assert.equal(isVisual3DRecipe({ version: 2, parts: [{ ...part, material: 'custom', color: '#94a790' }] }), true);
  assert.equal(isVisual3DRecipe({ version: 2, parts: [part], size: { width: 60, height: 100, depth: 2 }, fill: '#273545' }), true);
  assert.equal(isVisual3DRecipe({ version: 1, kind: 'plant' }), false, 'code presets are gone');
  assert.equal(isVisual3DRecipe({ version: 2, parts: [part], size: { width: 0, height: 1, depth: 1 } }), false);
  assert.equal(isVisual3DRecipe({ version: 2, parts: [part], fill: 'dark' }), false);
});

test('rejects what the renderer could not draw safely', () => {
  const bad = [
    { version: 3, parts: [part] },
    { version: 2, parts: [] },
    { version: 2, parts: Array.from({ length: MAX_VISUAL3D_PARTS + 1 }, () => part) },
    { version: 2, parts: [{ ...part, shape: 'mesh' }] },
    { version: 2, parts: [{ ...part, material: 'custom' }] },
    { version: 2, parts: [{ ...part, color: 'red' }] },
    { version: 2, parts: [{ ...part, size: [0, 1, 1] }] },
    { version: 2, parts: [{ ...part, size: [3, 1, 1] }] },
    { version: 2, parts: [{ ...part, position: [0, 5, 0] }] },
    { version: 2, parts: [{ ...part, rotation: [Number.NaN, 0, 0] }] },
    { version: 2, parts: [{ ...part, taper: 0 }] },
    'plant',
    null,
  ];
  for (const value of bad) assert.equal(isVisual3DRecipe(value), false, JSON.stringify(value)?.slice(0, 60));
  const result = validateVisual3DRecipe({ version: 2, parts: [{ ...part, shape: 'mesh' }] });
  assert.equal(result.issues[0]?.path, '$.parts[0].shape');
});

test('cloning keeps only schema fields and copies vectors', () => {
  const source = { ...part, extra: 'x' } as Visual3DPart;
  const copy = cloneVisual3DPart(source);
  assert.deepEqual(copy, { shape: 'cylinder', material: 'body', size: [0.43, 0.38, 0.43], position: [0, -0.31, 0], taper: 0.71 });
  assert.notEqual(copy.size, source.size);
});
