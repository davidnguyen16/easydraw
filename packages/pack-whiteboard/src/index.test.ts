import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createEmptyWhiteboardDocument,
  isWhiteboardDocument,
  validateWhiteboardDocument,
  DEFAULT_WHITEBOARD_SIZE,
  MAX_WHITEBOARD_SIZE,
} from './index.js';

// 1×1 transparent PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('whiteboard document', () => {
  it('starts blank at the default size', () => {
    const doc = createEmptyWhiteboardDocument();
    assert.deepEqual(doc, { version: 1, pack: 'whiteboard', ...DEFAULT_WHITEBOARD_SIZE, image: null });
    assert.equal(isWhiteboardDocument(doc), true);
  });

  it('accepts a PNG data URL and rejects other images', () => {
    assert.equal(isWhiteboardDocument({ ...createEmptyWhiteboardDocument(), image: PNG }), true);
    const jpeg = validateWhiteboardDocument({ ...createEmptyWhiteboardDocument(), image: 'data:image/jpeg;base64,/9j/' });
    assert.equal(jpeg.valid, false);
    assert.equal(jpeg.issues[0]?.path, '$.image');
  });

  it('bounds the size and requires integers', () => {
    assert.equal(isWhiteboardDocument(createEmptyWhiteboardDocument({ width: 0, height: 10 })), false);
    assert.equal(isWhiteboardDocument(createEmptyWhiteboardDocument({ width: MAX_WHITEBOARD_SIZE + 1, height: 10 })), false);
    assert.equal(isWhiteboardDocument(createEmptyWhiteboardDocument({ width: 10.5, height: 10 })), false);
    assert.equal(isWhiteboardDocument(createEmptyWhiteboardDocument({ width: 1, height: MAX_WHITEBOARD_SIZE })), true);
  });

  it('tells other documents apart', () => {
    assert.equal(isWhiteboardDocument({ pages: [], activePageId: 'p' }), false);
    assert.equal(isWhiteboardDocument({ version: 1, pack: 'other' }), false);
    assert.equal(isWhiteboardDocument(null), false);
  });
});
