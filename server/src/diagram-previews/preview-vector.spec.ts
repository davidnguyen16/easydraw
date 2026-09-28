import sharp from 'sharp';
import {
  isWhiteboardDiagramDraftV2,
  type WhiteboardDiagramDraftV2,
  type VectorGeometry,
} from '@easydraw/diagram-schema';
import {
  assertPreviewPayloadSize,
  convertPreviewDraft,
  hashPreviewDocument,
} from './preview-converter';
import {
  buildPreviewSourceCrops,
  previewWarnings,
} from './preview-source-crops';
import { processPreviewImage } from './preview-image';

const geometry = (): VectorGeometry => ({
  version: 1,
  commands: [
    { op: 'M', values: [0, 1000] },
    { op: 'Q', values: [500, 0, 1000, 1000] },
  ],
  stroke: '#0066ee',
  fill: 'none',
  strokeWidth: 3,
  dash: 'solid',
  startArrow: false,
  endArrow: false,
});
const drawing = (): WhiteboardDiagramDraftV2 => ({
  version: 2,
  outcome: 'diagram',
  nodes: [
    {
      id: 'label',
      shape: 'text',
      label: 'y = x - x² / 40',
      bounds: { x: 200, y: 800, width: 350, height: 40 },
      style: {
        stroke: '#000000',
        fill: 'none',
        textColor: '#000000',
        fontSize: 20,
        strokeWidth: 0,
      },
    },
  ],
  paths: [
    {
      id: 'trajectory',
      label: 'Parabolic trajectory',
      bounds: { x: 100, y: 100, width: 600, height: 600 },
      geometry: geometry(),
    },
  ],
  crops: [],
  edges: [],
  warnings: [],
});

describe('freeform preview conversion', () => {
  it('enforces the UTF-8 transport budget before publishing a ready document', () => {
    const document = convertPreviewDraft(drawing(), {
      width: 1000,
      height: 600,
    })!;
    expect(() => assertPreviewPayloadSize(document, [])).not.toThrow();
    document.pages[0].nodes[0].data!.oversized = '\u6f22'.repeat(310_000);
    expect(() => assertPreviewPayloadSize(document, [])).toThrow(/complex/);
  });
  it('preserves curve controls, thin shape bounds, style and independent text without mutating input', () => {
    const input = drawing();
    const before = JSON.stringify(input);
    expect(isWhiteboardDiagramDraftV2(input)).toBe(true);
    const document = convertPreviewDraft(input, { width: 1000, height: 600 })!;
    expect(document.pages[0].nodes[0]).toMatchObject({
      id: 'trajectory',
      type: 'VectorPathNode',
      width: 600,
      height: 360,
      position: { x: 100, y: 60 },
      data: { vector: geometry() },
    });
    expect(document.pages[0].nodes[1]).toMatchObject({
      type: 'TextNode',
      position: { x: 200, y: 480 },
      width: 350,
      height: 24,
      data: {
        label: 'y = x - x² / 40',
        preserveBounds: true,
        fontSize: 20,
        fillColor: 'transparent',
      },
    });
    const clone = convertPreviewDraft(input, { width: 1000, height: 600 })!;
    expect(hashPreviewDocument(document)).toBe(hashPreviewDocument(clone));
    const vector = document.pages[0].nodes[0].data!.vector as VectorGeometry;
    vector.commands[1].values[0] = 42;
    expect(JSON.stringify(input)).toBe(before);
    expect(hashPreviewDocument(document)).not.toBe(hashPreviewDocument(clone));
  });

  it('supports paths-only art, one-pixel lines and node-to-path connections', () => {
    const input = drawing();
    input.nodes = [];
    input.paths[0].bounds.height = 1;
    input.paths[0].geometry.commands = [
      { op: 'M', values: [0, 500] },
      { op: 'L', values: [1000, 500] },
    ];
    input.paths[0].geometry.endArrow = true;
    input.edges = [
      {
        id: 'edge',
        sourceId: 'trajectory',
        targetId: 'trajectory',
        label: '',
        direction: 'both',
        style: {
          stroke: '#aabbcc',
          strokeWidth: 2,
          dash: 'dashed',
          routing: 'straight',
        },
      },
    ];
    const result = convertPreviewDraft(input, { width: 1000, height: 1000 })!;
    expect(result.pages[0].nodes[0].height).toBe(1);
    expect(result.pages[0].edges[0].data).toMatchObject({
      routing: 'straight',
      lineStyle: 'dashed',
      strokeColor: '#aabbcc',
    });
  });

  it('does not create a diagram from unrecognized or accept unvalidated vector payloads', () => {
    const input = drawing();
    input.paths[0].geometry.stroke = 'url(https://attacker.invalid)';
    expect(() =>
      convertPreviewDraft(input, { width: 1000, height: 600 }),
    ).toThrow();
    expect(
      convertPreviewDraft(
        {
          version: 2,
          outcome: 'unrecognized',
          nodes: [],
          edges: [],
          paths: [],
          crops: [],
          warnings: [
            {
              code: 'unsupported-content',
              message: 'No drawing',
              elementId: null,
            },
          ],
        },
        { width: 100, height: 100 },
      ),
    ).toBeNull();
  });
});

describe('server-owned source image fallback', () => {
  const cropDrawing = (): WhiteboardDiagramDraftV2 => ({
    version: 2,
    outcome: 'diagram',
    nodes: [],
    edges: [],
    paths: [],
    crops: [
      {
        id: 'detail',
        label: 'Original detail',
        bounds: { x: 500, y: 0, width: 500, height: 1000 },
        reason: 'Complex symbol retained.',
      },
    ],
    warnings: [],
  });

  async function sourceImage() {
    const right = await sharp({
      create: { width: 50, height: 80, channels: 4, background: '#0000ff' },
    })
      .png()
      .toBuffer();
    const png = await sharp({
      create: { width: 100, height: 80, channels: 4, background: '#ff0000' },
    })
      .composite([{ input: right, left: 50, top: 0 }])
      .png()
      .toBuffer();
    return processPreviewImage(
      `data:image/png;base64,${png.toString('base64')}`,
      100,
      80,
    );
  }

  it('crops exact authorized source pixels, preserves aspect and embeds bounded PNG with provenance', async () => {
    const draft = cropDrawing();
    const before = JSON.stringify(draft);
    const source = await sourceImage();
    const crops = await buildPreviewSourceCrops(draft, source);
    const image = crops.get('detail')!;
    expect(image).toMatchObject({
      version: 1,
      width: 50,
      height: 80,
      reason: draft.crops[0].reason,
    });
    expect(image.dataUrl.length).toBeLessThanOrEqual(180000);
    const pixels = await sharp(
      Buffer.from(image.dataUrl.split(',')[1], 'base64'),
    )
      .raw()
      .toBuffer();
    expect([...pixels.subarray(0, 4)]).toEqual([0, 0, 255, 255]);
    const document = convertPreviewDraft(draft, source, crops)!;
    expect(document.pages[0].nodes[0]).toMatchObject({
      type: 'SourceImageNode',
      position: { x: 50, y: 0 },
      data: { image },
    });
    expect(previewWarnings(draft)[0]).toMatchObject({
      code: 'unsupported-content',
      elementId: 'detail',
    });
    expect(JSON.stringify(draft)).toBe(before);
    expect(hashPreviewDocument(document)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects missing, corrupt or remote crop data rather than degrading to a rectangle', async () => {
    const source = await sourceImage();
    expect(() => convertPreviewDraft(cropDrawing(), source)).toThrow();
    await expect(
      buildPreviewSourceCrops(cropDrawing(), {
        ...source,
        source: Buffer.from('not PNG'),
      }),
    ).rejects.toMatchObject({ code: 'invalid_image' });
    // Failure releases the decoder gate.
    expect((await buildPreviewSourceCrops(cropDrawing(), source)).size).toBe(1);
  });

  it('keeps an existing crop pixel-identical when refinement moves it or the sketch changes', async () => {
    const input = cropDrawing();
    const source = await sourceImage();
    const originalCrops = await buildPreviewSourceCrops(input, source);
    const parent = convertPreviewDraft(input, source, originalCrops)!;
    const before = JSON.stringify(parent);
    const revised = cropDrawing();
    // This region is RED in the source; the same ID must retain the BLUE crop.
    revised.crops[0].bounds.x = 0;
    const retained = await buildPreviewSourceCrops(revised, source, parent);
    expect(retained.get('detail')).toEqual(originalCrops.get('detail'));
    expect(retained.get('detail')).not.toBe(
      parent.pages[0].nodes[0].data!.image,
    );
    const result = convertPreviewDraft(revised, source, retained)!;
    expect(result.pages[0].nodes[0].position).toEqual({ x: 0, y: 0 });
    // A NEW ID explicitly requests replacement from the current source region.
    revised.crops[0].id = 'replacement';
    const replacement = await buildPreviewSourceCrops(revised, source, parent);
    const pixels = await sharp(
      Buffer.from(
        replacement.get('replacement')!.dataUrl.split(',')[1],
        'base64',
      ),
    )
      .raw()
      .toBuffer();
    expect([...pixels.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
    expect(JSON.stringify(parent)).toBe(before);
  });

  it('refuses corrupt retained crop data instead of silently cutting different pixels', async () => {
    const source = await sourceImage();
    const crops = await buildPreviewSourceCrops(cropDrawing(), source);
    const parent = convertPreviewDraft(cropDrawing(), source, crops)!;
    parent.pages[0].nodes[0].data!.image = { url: 'https://attacker.invalid' };
    await expect(
      buildPreviewSourceCrops(cropDrawing(), source, parent),
    ).rejects.toMatchObject({ code: 'invalid_document' });
  });

  it('bounds noisy crops and prioritizes explicit fallback warnings within the warning budget', async () => {
    const raw = Buffer.alloc(600 * 600 * 3);
    let seed = 1234;
    for (let i = 0; i < raw.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      raw[i] = seed >>> 24;
    }
    const png = await sharp(raw, {
      raw: { width: 600, height: 600, channels: 3 },
    })
      .png()
      .toBuffer();
    const source = await processPreviewImage(
      `data:image/png;base64,${png.toString('base64')}`,
      600,
      600,
    );
    const draft = cropDrawing();
    draft.crops[0].bounds = { x: 0, y: 0, width: 1000, height: 1000 };
    draft.warnings = Array.from({ length: 30 }, () => ({
      code: 'ambiguous-shape',
      elementId: null,
      message: 'Uncertain',
    }));
    const images = await buildPreviewSourceCrops(draft, source);
    expect(images.get('detail')!.dataUrl.length).toBeLessThanOrEqual(180000);
    expect(images.get('detail')!.width).toBeLessThanOrEqual(512);
    expect(previewWarnings(draft)).toHaveLength(30);
    expect(previewWarnings(draft)[0].elementId).toBe('detail');
  });
});
