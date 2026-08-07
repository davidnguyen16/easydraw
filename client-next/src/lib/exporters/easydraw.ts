/**
 * Native EasyDraw file format.
 *
 * Wraps the editor's JSON state inside a minimal XML envelope so the file
 * announces itself as `application/xml`, but the payload stays JSON to preserve
 * type fidelity (numbers, booleans, nested arrays) without writing a bespoke XML
 * schema for every node/edge variant.
 *
 * <?xml version="1.0" encoding="UTF-8"?>
 * <easydraw version="1">
 *   <state><![CDATA[ <json> ]]></state>
 * </easydraw>
 */
import { downloadBlob } from './download';
import type { Exporter } from './types';

export const FORMAT_VERSION = '1';

/** Serializes editor JSON into the .easydraw XML envelope. */
export function serializeEasyDraw(serializedState: string): string {
  // CDATA can't contain "]]>"; split it across two sections if present.
  const safe = serializedState.replace(/]]>/g, ']]]]><![CDATA[>');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<easydraw version="${FORMAT_VERSION}">\n` +
    `  <state><![CDATA[${safe}]]></state>\n` +
    `</easydraw>\n`
  );
}

/**
 * Extracts the JSON payload from an `.easydraw` XML envelope. Returns null if the
 * input isn't a recognizable envelope so callers can fall back to plain-JSON
 * parsing.
 */
export function parseEasyDraw(content: string): string | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('<?xml')) return null;

  const match = trimmed.match(/<state>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/state>/);
  if (!match) return null;

  // Reverse the escaping applied during serialization.
  return match[1].replace(/]]]]><!\[CDATA\[>/g, ']]>');
}

export const easydrawExporter: Exporter = {
  id: 'easydraw',
  label: 'XML',
  extension: '.easydraw',
  mimeType: 'application/xml',
  async run({ fileName, serializedState }) {
    const xml = serializeEasyDraw(serializedState);
    const blob = new Blob([xml], { type: 'application/xml' });
    downloadBlob(blob, `${fileName}.easydraw`);
  },
};
