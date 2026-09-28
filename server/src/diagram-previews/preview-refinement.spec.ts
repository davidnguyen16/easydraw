import { randomUUID } from 'node:crypto';
import { validate } from 'class-validator';
import type {
  PagedDiagramData,
  WhiteboardDiagramDraftV2,
} from '@easydraw/diagram-schema';
import { CreatePreviewDto } from './create-preview.dto';
import { hashPreviewDocument } from './preview-converter';
import {
  readStoredPreview,
  storePreviewDocument,
  type PreviewRefinementContext,
} from './preview-refinement';

const document: PagedDiagramData = {
  schemaVersion: 1,
  activePageId: 'page',
  pages: [
    {
      id: 'page',
      name: 'Preview',
      nodes: [{ id: 'nodeA', data: { label: 'A' } }],
      edges: [],
    },
  ],
};
const draft: WhiteboardDiagramDraftV2 = {
  version: 2,
  outcome: 'diagram',
  nodes: [
    {
      id: 'nodeA',
      shape: 'rectangle',
      label: 'A',
      bounds: { x: 100, y: 100, width: 100, height: 100 },
      style: {
        stroke: '#000000',
        fill: '#ffffff',
        textColor: '#000000',
        strokeWidth: 1,
        fontSize: 16,
      },
    },
  ],
  paths: [],
  edges: [],
  crops: [],
  warnings: [],
};
const context = (): PreviewRefinementContext => ({
  version: 1,
  hint: 'A manufacturing layout',
  feedbackHistory: ['Add a workstation'],
  draft: JSON.parse(JSON.stringify(draft)) as WhiteboardDiagramDraftV2,
  basePreviewId: randomUUID(),
});

describe('private preview refinement storage', () => {
  it('reads legacy diagrams without granting them made-up refinement context', () => {
    expect(readStoredPreview(document)).toEqual({ document, context: null });
  });

  it('keeps intent/history outside the visible document and document hash', () => {
    const stored = storePreviewDocument(document, context());
    const read = readStoredPreview(stored);
    expect(read.document).toEqual(document);
    expect(hashPreviewDocument(read.document)).toBe(
      hashPreviewDocument(document),
    );
    expect(read.context?.hint).toBe('A manufacturing layout');
    expect(read.document).not.toHaveProperty('context');
    expect(read.document).not.toHaveProperty('hint');
  });

  it('copies on both write and read, preserving immutable snapshots', () => {
    const inputDocument = structuredClone(document),
      inputContext = context();
    const stored = storePreviewDocument(inputDocument, inputContext);
    inputContext.feedbackHistory.push('Later mutation');
    inputContext.draft.nodes[0].label = 'Mutated';
    inputDocument.pages[0].nodes[0].data!.label = 'Mutated';
    const read = readStoredPreview(stored);
    expect(read.context?.feedbackHistory).toEqual(['Add a workstation']);
    expect(read.context?.draft.nodes[0].label).toBe('A');
    expect(read.document.pages[0].nodes[0].data?.label).toBe('A');
    read.context!.feedbackHistory.push('Reader mutation');
    read.document.pages[0].nodes[0].data!.label = 'Reader mutation';
    expect(stored.context.feedbackHistory).toEqual(['Add a workstation']);
    expect(stored.document.pages[0].nodes[0].data?.label).toBe('A');
  });

  it.each([
    { hint: 'x'.repeat(4001) },
    { feedbackHistory: Array(11).fill('Change') },
    { feedbackHistory: ['   '] },
    { feedbackHistory: ['x'.repeat(2001)] },
    { basePreviewId: 'not-an-id' },
    { draft: { ...draft, version: 999 } },
    { draft: { ...draft, nodes: [{ ...draft.nodes[0], id: '<script>' }] } },
  ])(
    'rejects invalid stored context rather than forwarding it to AI: %j',
    (override) => {
      const value = { ...context(), ...override } as PreviewRefinementContext;
      expect(() => storePreviewDocument(document, value)).toThrow();
      expect(() =>
        readStoredPreview({
          kind: 'easydraw-preview',
          version: 1,
          document,
          context: value,
        }),
      ).toThrow();
    },
  );

  it('rejects corrupt envelopes instead of treating them as old documents', () => {
    const stored = storePreviewDocument(document, context());
    expect(() => readStoredPreview({ ...stored, version: 2 })).toThrow();
    expect(() => readStoredPreview({ ...stored, document: null })).toThrow();
    expect(() => readStoredPreview({ ...stored, context: null })).toThrow();
  });

  it('bounds private JSON payloads in addition to the public preview payload', () => {
    const oversized = structuredClone(document);
    oversized.pages[0].nodes[0].data!.label = 'x'.repeat(1024 * 1024);
    expect(() => storePreviewDocument(oversized, context())).toThrow();
  });
});

describe('preview intent DTO limits', () => {
  const dto = (override = {}) =>
    Object.assign(new CreatePreviewDto(), {
      clientRequestId: randomUUID(),
      width: 800,
      height: 600,
      image: 'data:image/png;base64,AA==',
      hint: 'x'.repeat(4000),
      basePreviewId: randomUUID(),
      feedback: 'y'.repeat(2000),
      ...override,
    });

  it('accepts supported limits without restricting design domain', async () => {
    expect(await validate(dto())).toEqual([]);
  });

  it.each([
    { hint: 'x'.repeat(4001) },
    { feedback: 'y'.repeat(2001) },
    { basePreviewId: 'client-graph' },
  ])('rejects over-limit or malformed fields', async (override) => {
    expect((await validate(dto(override))).length).toBeGreaterThan(0);
  });
});
