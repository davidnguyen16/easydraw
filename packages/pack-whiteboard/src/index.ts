/**
 * Whiteboard document — the raster the whiteboard editor paints on.
 *
 * A whiteboard is a bitmap, so the document is the bitmap: a PNG data URL
 * plus its size. Nothing derived (zoom, tool, colours) is stored; a blank
 * board stores no image at all. The pack owns the schema and validation so
 * the server, the editor and any future exporter agree on what is saved in
 * `Diagram.data`: the pack owns the document's shape, the database does not.
 */
import { createValidationResult, type ValidationIssue, type ValidationResult } from '@easydraw/shared-types';

export const WHITEBOARD_DOCUMENT_VERSION = 1 as const;

/** Bounds that keep a board drawable in a browser canvas and sane to store. */
export const MIN_WHITEBOARD_SIZE = 1;
export const MAX_WHITEBOARD_SIZE = 8192;

export const DEFAULT_WHITEBOARD_SIZE = { width: 1280, height: 800 } as const;

export interface WhiteboardDocumentV1 {
  version: typeof WHITEBOARD_DOCUMENT_VERSION;
  pack: 'whiteboard';
  width: number;
  height: number;
  /** PNG of the whole board (`data:image/png;base64,…`), or null when blank. */
  image: string | null;
}

export function createEmptyWhiteboardDocument(
  size: { width: number; height: number } = DEFAULT_WHITEBOARD_SIZE,
): WhiteboardDocumentV1 {
  return { version: WHITEBOARD_DOCUMENT_VERSION, pack: 'whiteboard', width: size.width, height: size.height, image: null };
}

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_WHITEBOARD_SIZE && value <= MAX_WHITEBOARD_SIZE;
}

export function validateWhiteboardDocument(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const issue = (code: string, message: string, path: string) => issues.push({ code, message, path, severity: 'error' });
  if (!isRecord(value)) {
    issue('whiteboard.not_object', 'Whiteboard document must be an object.', '$');
    return createValidationResult(issues);
  }
  if (value.version !== WHITEBOARD_DOCUMENT_VERSION) issue('whiteboard.version', 'Unsupported whiteboard document version.', '$.version');
  if (value.pack !== 'whiteboard') issue('whiteboard.pack', 'Document is not a whiteboard.', '$.pack');
  if (!isSize(value.width)) issue('whiteboard.width', `width must be an integer between ${MIN_WHITEBOARD_SIZE} and ${MAX_WHITEBOARD_SIZE}.`, '$.width');
  if (!isSize(value.height)) issue('whiteboard.height', `height must be an integer between ${MIN_WHITEBOARD_SIZE} and ${MAX_WHITEBOARD_SIZE}.`, '$.height');
  if (value.image !== null && (typeof value.image !== 'string' || !PNG_DATA_URL.test(value.image))) {
    issue('whiteboard.image', 'image must be a PNG data URL or null.', '$.image');
  }
  return createValidationResult(issues);
}

export function isWhiteboardDocument(value: unknown): value is WhiteboardDocumentV1 {
  return validateWhiteboardDocument(value).valid;
}
