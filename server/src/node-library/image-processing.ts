import { createHash } from 'node:crypto';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import sharp from 'sharp';
import { InvalidUploadedFileError } from './s3-assets.service';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
// Static vector subset only: no script, style, external resources, use/image,
// animation, foreignObject, filters, links, or untrusted CSS evaluation.
const ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'title',
  'desc',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
]);
const ATTRIBUTES = new Set([
  'id',
  'version',
  'viewBox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'transform',
  'fill',
  'fill-rule',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'fx',
  'fy',
  'fr',
  'clip-path',
  'clip-rule',
  'clipPathUnits',
  'preserveAspectRatio',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'dx',
  'dy',
  'rotate',
  'letter-spacing',
]);

export function sanitizeStaticSvg(input: Buffer): Buffer {
  if (input.length > 1024 * 1024)
    throw new InvalidUploadedFileError('SVG files must be at most 1 MiB.');
  const source = input.toString('utf8');
  // Reject declarations before parsing to prevent entity expansion. Remaining
  // structure is validated by XML parsing, not by regex sanitization.
  if (/<!DOCTYPE|<!ENTITY/i.test(source) || source.includes('\u0000')) {
    throw new InvalidUploadedFileError(
      'SVG declarations and entities are not supported.',
    );
  }
  let document: ReturnType<DOMParser['parseFromString']>;
  try {
    document = new DOMParser({
      onError: () => {
        throw new Error('Malformed SVG XML');
      },
    }).parseFromString(source, 'image/svg+xml');
  } catch {
    throw new InvalidUploadedFileError('SVG must be well-formed XML.');
  }
  const root = document.documentElement;
  if (!root || root.tagName !== 'svg' || root.namespaceURI !== SVG_NAMESPACE) {
    throw new InvalidUploadedFileError('A namespaced SVG root is required.');
  }
  let count = 0;
  const visit = (element: typeof root, depth: number) => {
    if (++count > 10000 || depth > 50)
      throw new InvalidUploadedFileError('SVG is too complex.');
    if (
      element.namespaceURI !== SVG_NAMESPACE ||
      !ELEMENTS.has(element.tagName)
    ) {
      throw new InvalidUploadedFileError(
        `SVG element ${element.tagName} is not supported. Use static vector shapes or PNG.`,
      );
    }
    for (let index = 0; index < element.attributes.length; index++) {
      const attribute = element.attributes.item(index)!;
      if (attribute.name === 'xmlns' && attribute.value === SVG_NAMESPACE)
        continue;
      if (attribute.namespaceURI || !ATTRIBUTES.has(attribute.name)) {
        throw new InvalidUploadedFileError(
          `SVG attribute ${attribute.name} is not supported.`,
        );
      }
      const value = attribute.value;
      // No CSS escapes, declarations, schemes, external IRIs or control chars.
      if (
        // eslint-disable-next-line no-control-regex -- Explicitly reject XML/CSS control bytes.
        /[\\<>;@\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) ||
        /(?:https?:|data:|file:|javascript:|\/\/)/i.test(value)
      ) {
        throw new InvalidUploadedFileError(
          'SVG external resources and CSS are not supported.',
        );
      }
      if (
        /url\s*\(/i.test(value) &&
        !/^url\(#[A-Za-z_][\w.-]*\)$/.test(value)
      ) {
        throw new InvalidUploadedFileError(
          'Only local SVG paint/clip references are allowed.',
        );
      }
      if (value.length > 100000)
        throw new InvalidUploadedFileError('SVG attribute is too long.');
    }
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) visit(child as typeof root, depth + 1);
      else if (![3, 4, 8].includes(child.nodeType))
        throw new InvalidUploadedFileError('Unsupported SVG XML node.');
    }
  };
  for (let node = document.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 7 && node.nodeName !== 'xml')
      throw new InvalidUploadedFileError(
        'SVG processing instructions are not supported.',
      );
    if (node.nodeType === 10)
      throw new InvalidUploadedFileError(
        'SVG document types are not supported.',
      );
  }
  visit(root, 0);
  return Buffer.from(new XMLSerializer().serializeToString(root));
}

export async function processUploadedImage(
  input: Buffer,
  contentType: string,
  maxPixels: number,
) {
  const safeInput =
    contentType === 'image/svg+xml' ? sanitizeStaticSvg(input) : input;
  try {
    const options = {
      limitInputPixels: maxPixels,
      animated: false,
      failOn: 'warning' as const,
    };
    const metadata = await sharp(safeInput, options).metadata();
    const formats: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpeg',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };
    if (metadata.format !== formats[contentType])
      throw new InvalidUploadedFileError(
        'File contents do not match the declared MIME type.',
      );
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > maxPixels ||
      (metadata.pages ?? 1) > 1
    ) {
      throw new InvalidUploadedFileError(
        'Image dimensions are unsupported. Animated images are not supported.',
      );
    }
    // Strip metadata and active/vector content. Every published asset is a
    // decoded-and-reencoded PNG, safe for both canvas and WebGL texture use.
    const image = await sharp(safeInput, options)
      .rotate()
      .resize({
        width: 4096,
        height: 4096,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .timeout({ seconds: 15 })
      .toBuffer({ resolveWithObject: true });
    const thumbnail = await sharp(image.data)
      .resize({
        width: 160,
        height: 160,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .timeout({ seconds: 5 })
      .toBuffer();
    return {
      image: image.data,
      thumbnail,
      width: image.info.width,
      height: image.info.height,
      checksum: createHash('sha256').update(image.data).digest('hex'),
    };
  } catch (error) {
    if (error instanceof InvalidUploadedFileError) throw error;
    throw new InvalidUploadedFileError(
      'File could not be decoded safely. Use a valid PNG, JPEG, WebP, or static SVG.',
    );
  }
}
