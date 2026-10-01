import { afterEach, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { isWhiteboardDocument } from '@easydraw/pack-whiteboard';
import { createDataCentreWhiteboardDocument, DATA_CENTRE_WHITEBOARD_SAMPLE } from './data-centre';

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
});

it('does not create a whiteboard from a missing sample asset', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
  await expect(createDataCentreWhiteboardDocument()).rejects.toThrow('Could not load the Data Centre sketch');
});
