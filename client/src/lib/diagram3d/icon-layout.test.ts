import { describe, expect, it } from 'vitest';
import { PLATFORM_HEIGHT, iconLayout, imageStyleOf } from './icon-layout';

describe('iconLayout', () => {
  // A 120×120 px image node: the scene gives it a 1.2 × 0.06 × 1.2 footprint.
  const size: [number, number, number] = [1.2, 0.06, 1.2];

  it('stands a thin platform on the footprint and the icon just above it', () => {
    const layout = iconLayout(size, 256, 205);
    expect(layout.platformSize).toEqual([1.2, PLATFORM_HEIGHT, 1.2]);
    expect(layout.platformCenterY).toBeCloseTo(-0.03 + PLATFORM_HEIGHT / 2);
    expect(layout.imageWidth).toBeCloseTo(1.2 * 0.78);
    expect(layout.imageHeight).toBeCloseTo((1.2 * 0.78) / (256 / 205));
    expect(layout.imageCenterY - layout.imageHeight / 2).toBeCloseTo(-0.03 + PLATFORM_HEIGHT + 0.05);
  });

  it('gives a real object used as a base its own height', () => {
    const platform = iconLayout(size, 1, 1, 'platform');
    const object = iconLayout(size, 1, 1, 'object');
    expect(object.platformSize[1]).toBeGreaterThan(platform.platformSize[1] * 4);
    expect(object.imageCenterY).toBeGreaterThan(platform.imageCenterY);
  });

  it('covers icon and base with the hit box so the icon is clickable', () => {
    const layout = iconLayout(size, 1, 2);
    const top = layout.imageCenterY + layout.imageHeight / 2;
    expect(layout.hitCenterY + layout.hitHeight / 2).toBeCloseTo(top);
    expect(layout.hitCenterY - layout.hitHeight / 2).toBeCloseTo(-0.03);
  });

  it('defaults to the round platform; flat only when nothing sits underneath', () => {
    expect(imageStyleOf({}, null)).toBe('puck');
    expect(imageStyleOf({ imageStyle3d: 'plinth' }, null)).toBe('plinth');
    expect(imageStyleOf({ imageStyle3d: 'flat' }, null)).toBe('flat');
    expect(imageStyleOf({ imageStyle3d: 'flat' }, { version: 2, parts: [{ shape: 'box', material: 'body', size: [1, 1, 1], position: [0, 0, 0] }] })).toBe('puck');
  });
});
