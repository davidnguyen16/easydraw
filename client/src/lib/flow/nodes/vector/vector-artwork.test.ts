import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { VectorGeometry } from '@easydraw/diagram-schema';
import VectorArtwork from './VectorArtwork';
import SourceImageArtwork, { SOURCE_IMAGE_NOTICE } from '../source-image/SourceImageArtwork';
import { resolveVectorAppearance, vectorCommandsInBox, vectorPathInBox } from './vector-artwork';

const geometry = (): VectorGeometry => ({ version: 1,
  commands: [{ op: 'M', values: [0, 500] }, { op: 'Q', values: [500, 0, 1000, 500] }],
  stroke: '#123456', fill: 'none', strokeWidth: 2, dash: 'dashed', startArrow: true, endArrow: true,
});
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6LVsAAAAASUVORK5CYII=';

describe('safe generic vector artwork', () => {
  it('scales only coordinates, preserving curves and the input geometry', () => {
    const value = geometry();
    const before = structuredClone(value);
    expect(vectorPathInBox(value, 200, 80)).toBe('M0 40 Q100 0 200 40');
    expect(vectorCommandsInBox(value, 200, 80)[1].op).toBe('Q');
    expect(value).toEqual(before);
    expect(vectorPathInBox({ ...value, commands: [{ op: 'SCRIPT', values: [] }] }, 200, 80)).toBe('');
  });

  it('honors bounded generic style overrides without allowing SVG URL paints', () => {
    expect(resolveVectorAppearance(geometry(), { borderColor: '#ff0000', fillColor: '#abcdef', borderWidth: 3, opacity: 40 }))
      .toEqual({ stroke: '#ff0000', fill: '#abcdef', strokeWidth: 3, opacity: 0.4, dashArray: '8 5' });
    expect(resolveVectorAppearance(geometry(), { borderColor: 'url(https://example.invalid/a.svg)', fillColor: '<svg>', borderWidth: Infinity, opacity: NaN }))
      .toEqual({ stroke: '#123456', fill: 'none', strokeWidth: 2, opacity: 1, dashArray: '8 5' });
    expect(resolveVectorAppearance(geometry(), { borderWidth: -2, opacity: 200 }).strokeWidth).toBe(0);
  });

  it('renders non-scaling paths, unique arrow markers, and only semantic labels', () => {
    const data = { label: 'Meaning only', vector: geometry() };
    const html = renderToStaticMarkup(createElement('div', null,
      createElement(VectorArtwork, { data, width: 200, height: 80 }),
      createElement(VectorArtwork, { data, width: 200, height: 80 })));
    expect(html).toContain('d="M0 40 Q100 0 200 40"');
    expect(html).toContain('vector-effect="non-scaling-stroke"');
    expect(html).toContain('stroke-dasharray="8 5"');
    expect(html).toContain('marker-start="url(#vector-arrow-');
    expect(html).toContain('marker-end="url(#vector-arrow-');
    const markerIds = [...html.matchAll(/<marker id="([^"]+)"/g)].map((match) => match[1]);
    expect(markerIds).toHaveLength(2);
    expect(new Set(markerIds).size).toBe(2);
    expect(html).toContain('<title>Meaning only</title>');
    expect(html).not.toContain('<text');
    expect(html).not.toContain('textarea');
  });

  it('shows an explicit placeholder for invalid geometry instead of inventing a rectangle', () => {
    const html = renderToStaticMarkup(createElement(VectorArtwork, { data: { vector: { malicious: '<svg>' } } }));
    expect(html).toContain('Vector unavailable');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<rect');
  });

  it('renders only bounded inline PNG crops and marks their pixels as non-editable', () => {
    const html = renderToStaticMarkup(createElement(SourceImageArtwork, { data: {
      label: 'Sketch detail', image: { version: 1, dataUrl: png, width: 1, height: 1, reason: 'Preserved original detail.' },
    } }));
    expect(html).toContain(png);
    expect(html).toContain(SOURCE_IMAGE_NOTICE);
    expect(html).toContain('Preserved original detail.');
    expect(html).toContain('data-custom-image-state="loading"');
    const invalid = renderToStaticMarkup(createElement(SourceImageArtwork, { data: {
      image: { version: 1, dataUrl: 'https://example.invalid/track', width: 1, height: 1, reason: '' },
    } }));
    expect(invalid).toContain('Source image unavailable');
    expect(invalid).not.toContain('https://');
    expect(invalid).not.toContain('<img');
    expect(invalid).toContain('data-custom-image-state="error"');
  });
});
