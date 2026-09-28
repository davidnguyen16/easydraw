/**
 * @easydraw/diagram-import — read other tools' diagram files into EasyDraw's
 * document format.
 *
 * One entry point, `importDiagram`, sniffs the content (never just the file
 * extension: a `.xml` may be draw.io's, EasyDraw's own, or something else)
 * and hands it to the matching importer. Every importer returns the same
 * `ImportResult`: a ready-to-load document plus a list of what could not be
 * carried across, so the editor can open the file and tell the user what
 * to check rather than refusing it.
 *
 * Supported: draw.io / diagrams.net (.drawio, .xml) and Visio VSDX (.vsdx),
 * which is also how Lucidchart documents arrive (Lucid → Export → Visio).
 */
import { importDrawio, looksLikeDrawio } from './drawio/index.js';
import { importVsdx, looksLikeVsdx } from './vsdx/index.js';
import type { ImportResult } from './document.js';

export type { ImportFormat, ImportResult, ImportSuccess, ImportFailure, ImportWarning, ImportWarningCode } from './document.js';
export { importDrawio, decompressDiagram } from './drawio/index.js';
export { importVsdx } from './vsdx/index.js';

export type DetectedFormat = 'drawio' | 'vsdx' | 'easydraw' | 'vdx' | 'unknown';

export const IMPORT_EXTENSIONS = ['.drawio', '.xml', '.vsdx'] as const;

/** Display names for the formats the picker should advertise. */
export const IMPORT_FORMAT_LABELS: Record<Exclude<DetectedFormat, 'unknown' | 'easydraw' | 'vdx'>, string> = {
  drawio: 'draw.io',
  vsdx: 'Visio / Lucidchart (VSDX)',
};

/**
 * Sniffs a file's content. Text inputs are checked for the XML roots each
 * tool writes; binary inputs for a zip that could be a VSDX package.
 */
export function detectFormat(input: string | Uint8Array): DetectedFormat {
  if (typeof input !== 'string') {
    if (looksLikeVsdx(input)) return 'vsdx';
    return detectFormat(new TextDecoder().decode(input.subarray(0, 4096)));
  }
  const head = input.slice(0, 4096);
  if (looksLikeDrawio(head)) return 'drawio';
  if (/<state>\s*<!\[CDATA\[/.test(head) || /^\s*\{/.test(head)) return 'easydraw';
  if (/<VisioDocument[\s>]/.test(head)) return 'vdx';
  return 'unknown';
}

/**
 * Imports a file of any supported format. `bytes` is the raw file; the
 * importer decides whether to treat it as text or as a zip package.
 */
export function importDiagram(bytes: Uint8Array, fileName: string): ImportResult {
  const format = detectFormat(bytes);
  const title = fileName.replace(/\.[^.]+$/, '') || 'Imported diagram';
  switch (format) {
    case 'drawio':
      return importDrawio(new TextDecoder().decode(bytes), title);
    case 'vsdx':
      return importVsdx(bytes, title);
    case 'vdx':
      return {
        ok: false,
        format: 'unknown',
        error: 'Visio 2010 XML (.vdx) is not supported. In Visio or Lucidchart, export as Visio (VSDX) instead.',
      };
    case 'easydraw':
      return { ok: false, format: 'unknown', error: 'This is an EasyDraw file; open it with File › Open.' };
    default:
      return {
        ok: false,
        format: 'unknown',
        error: `Unrecognised file. EasyDraw can import ${Object.values(IMPORT_FORMAT_LABELS).join(', ')}.`,
      };
  }
}
