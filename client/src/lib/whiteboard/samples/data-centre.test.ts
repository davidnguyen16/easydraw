import { afterEach, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { isWhiteboardDocument } from '@easydraw/pack-whiteboard';
import { createDataCentreDocument } from '@/lib/diagram3d/samples/data-centre';
import { createDataCentreBuiltInPreview, createDataCentreWhiteboardDocument, DATA_CENTRE_WHITEBOARD_SAMPLE } from './data-centre';

afterEach(() => vi.unstubAllGlobals());

it('creates an editable whiteboard copy from the shipped PNG', async () => {
  const bytes = await readFile(new URL('../../../../public/samples/data-centre-hand-sketch.png', import.meta.url));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob([bytes], { type: 'image/png' }))));
  class MockFileReader {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
        this.onload?.();
      }, () => this.onerror?.());
    }
  }
  vi.stubGlobal('FileReader', MockFileReader);

  const document = await createDataCentreWhiteboardDocument();
  expect(isWhiteboardDocument(document)).toBe(true);
  expect({ width: document.width, height: document.height }).toEqual({
    width: DATA_CENTRE_WHITEBOARD_SAMPLE.width,
    height: DATA_CENTRE_WHITEBOARD_SAMPLE.height,
  });
  expect(Buffer.from(document.image!.split(',')[1]!, 'base64')).toEqual(bytes);
  expect(document.sample).toBe(DATA_CENTRE_WHITEBOARD_SAMPLE.id);
});

it('answers Generate with the dashboard Data Centre diagram instead of an AI request', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  const preview = createDataCentreBuiltInPreview();
  const result = await preview.generate({ id: '11111111-1111-4111-8111-111111111111', whiteboardId: '22222222-2222-4222-8222-222222222222',
    source: { width: 1600, height: 1120, image: 'data:image/png;base64,AA==', revision: 1 }, hint: DATA_CENTRE_WHITEBOARD_SAMPLE.prompt }, 1_000);
  expect(result.document).toEqual(createDataCentreDocument());
  expect(result.document?.pages[0]?.nodes.some((node) => node.type === 'CubeNode')).toBe(true);
  expect(preview.openQuery).toBe('?view=3d');
  expect(fetchSpy).not.toHaveBeenCalled();
});

it('does not create a whiteboard from a missing sample asset', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
  await expect(createDataCentreWhiteboardDocument()).rejects.toThrow('Could not load the Data Centre sketch');
});
