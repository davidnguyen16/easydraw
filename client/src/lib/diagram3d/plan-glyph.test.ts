import { describe, expect, it } from 'vitest';
import type { Visual3DRecipe } from '@easydraw/diagram-schema';
import { planShapes } from './plan-glyph';

const HALF_PI = Math.PI / 2;

describe('planShapes', () => {
  it('projects parts onto the node box, higher parts painted last and lighter', () => {
    const recipe: Visual3DRecipe = { version: 2, parts: [
      { shape: 'box', material: 'custom', color: '#404040', size: [0.5, 0.2, 0.5], position: [0.25, 0.4, -0.25] },
      { shape: 'box', material: 'body', size: [1, 0.2, 1], position: [0, -0.4, 0] },
    ] };
    const shapes = planShapes(recipe, '#808080');
    expect(shapes.map((s) => s.kind)).toEqual(['rect', 'rect']);
    // The floor slab first (lower), then the raised block; x → x, z → y.
    expect(shapes[0]).toMatchObject({ cx: 50, cy: 50, w: 100, h: 100 });
    expect(shapes[1]).toMatchObject({ cx: 75, cy: 25, w: 50, h: 50 });
    const brightness = (hex: string) => parseInt(hex.slice(1, 3), 16);
    expect(brightness(shapes[1]!.fill)).toBeGreaterThan(brightness('#404040'));
    expect(brightness(shapes[0]!.fill)).toBeLessThan(brightness(shapes[1]!.fill) + 0x80 - 0x40);
  });

  it('knows which parts read as circles, rectangles or rings from above', () => {
    const recipe: Visual3DRecipe = { version: 2, parts: [
      { shape: 'cylinder', material: 'silver', size: [0.4, 1, 0.4], position: [0, 0, 0] },
      { shape: 'cylinder', material: 'silver', size: [0.2, 1, 0.2], position: [0, 0, 0], rotation: [0, 0, HALF_PI] },
      { shape: 'sphere', material: 'red', size: [0.3, 0.3, 0.3], position: [0, 0, 0] },
      { shape: 'torus', material: 'silver', size: [0.5, 0.5, 0.2], position: [0, 0, 0], rotation: [HALF_PI, 0, 0] },
      { shape: 'torus', material: 'silver', size: [0.5, 0.5, 0.2], position: [0, 0, 0] },
    ] };
    const kinds = planShapes(recipe, '#ffffff').map((s) => [s.kind, Math.round(s.w), Math.round(s.h)]);
    expect(kinds).toContainEqual(['ellipse', 40, 40]); // standing cylinder
    expect(kinds).toContainEqual(['rect', 100, 20]); // cylinder on its side shows its length
    expect(kinds).toContainEqual(['ellipse', 30, 30]); // sphere
    expect(kinds).toContainEqual(['ring', 50, 50]); // flat torus: its diameter lies on the floor
    expect(kinds).toContainEqual(['rect', 50, 20]); // upright torus is a thin bar from above
  });

  it('turns a rotation about the vertical axis into a screen rotation', () => {
    const recipe: Visual3DRecipe = { version: 2, parts: [{ shape: 'box', material: 'body', size: [1, 1, 0.2], position: [0, 0, 0], rotation: [0, Math.PI / 4, 0] }] };
    expect(planShapes(recipe, '#ffffff')[0]!.rotate).toBeCloseTo(-45);
  });
});
