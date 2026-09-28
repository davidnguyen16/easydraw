import {
  isDiagramData,
  type PagedDiagramData,
  type WhiteboardDiagramDraftV1,
} from '@easydraw/diagram-schema';
import { convertPreviewDraft, hashPreviewDocument } from './preview-converter';

const draft = (): WhiteboardDiagramDraftV1 => ({
  version: 1,
  outcome: 'diagram',
  nodes: [
    {
      id: 'start',
      shape: 'rectangle',
      label: 'Bắt đầu',
      bounds: { x: 100, y: 100, width: 200, height: 100 },
    },
    {
      id: 'finish',
      shape: 'database',
      label: 'Database',
      bounds: { x: 600, y: 100, width: 200, height: 100 },
    },
  ],
  edges: [
    {
      id: 'request',
      sourceId: 'start',
      targetId: 'finish',
      label: 'Send',
      direction: 'forward',
    },
  ],
  warnings: [],
});
const dimensions = { width: 2000, height: 1000 };

describe('server preview conversion', () => {
  it('creates editable geometry deterministically without mutating recognition data', () => {
    const input = draft();
    const before = structuredClone(input);
    const a = convertPreviewDraft(input, dimensions)!;
    const b = convertPreviewDraft(input, dimensions)!;
    expect(input).toEqual(before);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(isDiagramData(a)).toBe(true);
    expect(a.pages[0].nodes[0]).toMatchObject({
      id: 'start',
      type: 'RectangleNode',
      width: 320,
      height: 80,
      position: { x: 160, y: 80 },
      data: { label: 'Bắt đầu' },
    });
    expect(a.pages[0].edges[0]).toMatchObject({
      source: 'start',
      target: 'finish',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        routing: 'orthogonal',
        markerStart: 'none',
        markerEnd: 'triangle',
        labels: [{ id: 'request-label', text: 'Send', t: 0.5 }],
      },
    });
    a.pages[0].nodes[0].data!.label = 'Changed locally';
    expect(input).toEqual(before);
    expect(b.pages[0].nodes[0].data!.label).toBe('Bắt đầu');
  });

  it.each([
    ['rectangle', 'RectangleNode'],
    ['rounded-rectangle', 'RoundedRectangleNode'],
    ['ellipse', 'EllipseNode'],
    ['diamond', 'DiamondNode'],
    ['database', 'DatabaseNode'],
    ['text', 'TextNode'],
  ] as const)('maps %s to an existing editable shape', (shape, type) => {
    const input = draft();
    input.nodes[0].shape = shape;
    input.nodes[0].bounds.width = 1;
    const result = convertPreviewDraft(input, dimensions)!;
    expect(result.pages[0].nodes[0].type).toBe(type);
    expect(result.pages[0].nodes[0].width).toBe(shape === 'text' ? 80 : 40);
  });

  it('handles all arrow directions, self loops, and ties deterministically', () => {
    const input = draft();
    input.edges = [
      {
        id: 'loop',
        sourceId: 'start',
        targetId: 'start',
        label: '',
        direction: 'none',
      },
      {
        id: 'both',
        sourceId: 'start',
        targetId: 'finish',
        label: '',
        direction: 'both',
      },
    ];
    const edges = convertPreviewDraft(input, dimensions)!.pages[0].edges;
    expect(edges[0]).toMatchObject({
      sourceHandle: 'right',
      targetHandle: 'top',
      data: { markerStart: 'none', markerEnd: 'none', labels: [] },
    });
    expect(edges[1].data).toMatchObject({
      markerStart: 'triangle',
      markerEnd: 'triangle',
    });
  });

  it('rejects invalid input and keeps unrecognized distinct from an empty diagram', () => {
    const invalid = draft();
    invalid.edges[0].targetId = 'missing';
    expect(() => convertPreviewDraft(invalid, dimensions)).toThrow(
      /validation/,
    );
    expect(() =>
      convertPreviewDraft(draft(), { width: 4001, height: 4000 }),
    ).toThrow(/dimensions/);
    expect(
      convertPreviewDraft(
        {
          version: 1,
          outcome: 'unrecognized',
          nodes: [],
          edges: [],
          warnings: [
            {
              code: 'unsupported-content',
              message: 'No diagram.',
              elementId: null,
            },
          ],
        },
        dimensions,
      ),
    ).toBeNull();
  });

  it('hashes object keys canonically but preserves array order and exact labels', () => {
    const document = convertPreviewDraft(draft(), dimensions)!;
    const reorderedKeys: PagedDiagramData = {
      pages: document.pages,
      activePageId: document.activePageId,
      schemaVersion: document.schemaVersion,
    };
    const first = hashPreviewDocument(document);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPreviewDocument(reorderedKeys)).toBe(first);
    // Persisted Prisma JSON is read in the current realm. Jest's native
    // structuredClone uses a different realm's Object/Array prototypes.
    const reorderedNodes = JSON.parse(
      JSON.stringify(document),
    ) as PagedDiagramData;
    reorderedNodes.pages[0].nodes.reverse();
    expect(hashPreviewDocument(reorderedNodes)).not.toBe(first);
    const edited = JSON.parse(JSON.stringify(document)) as PagedDiagramData;
    edited.pages[0].nodes[0].data!.label = 'A different label';
    expect(hashPreviewDocument(edited)).not.toBe(first);
  });

  it.each([NaN, Infinity, undefined, () => undefined])(
    'rejects non-JSON values rather than silently hashing them',
    (invalid) => {
      const document = convertPreviewDraft(draft(), dimensions)!;
      document.pages[0].nodes[0].data!.invalid = invalid;
      expect(() => hashPreviewDocument(document)).toThrow(/validated/);
    },
  );
});
