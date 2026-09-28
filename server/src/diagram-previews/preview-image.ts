import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { PreviewPipelineError } from './preview-provider.service';

export const INPUT_PIPELINE_VERSION = 'whiteboard-png-v1';
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PIXELS = 16_000_000;
const DATA_URL_PREFIX = 'data:image/png;base64,';
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// One bounded decode per server process; do not queue unbounded 16 MP buffers
// while other users wait for the same process's image worker.
let processingImage = false;

export interface ProcessedPreviewImage {
  source: Buffer;
  modelInput: Buffer;
  sourceSHA256: string;
  modelInputSHA256: string;
  width: number;
  height: number;
  byteSize: number;
  modelInputWidth: number;
  modelInputHeight: number;
}

/** Reject APNG explicitly, even if a decoder would silently read only frame 1.
 * Sharp still performs full decoding and validates image content afterwards. */
function validatePngContainer(input: Buffer): void {
  if (!input.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new PreviewPipelineError('invalid_image');
  }
  let offset = 8;
  let first = true;
  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > input.length || (first && (type !== 'IHDR' || length !== 13))) {
      throw new PreviewPipelineError('invalid_image');
    }
    first = false;
    if (['acTL', 'fcTL', 'fdAT'].includes(type)) {
      throw new PreviewPipelineError('invalid_image');
    }
    if (type === 'IEND') {
      if (length !== 0 || end !== input.length)
        throw new PreviewPipelineError('invalid_image');
      return;
    }
    offset = end;
  }
  throw new PreviewPipelineError('invalid_image');
}

export async function processPreviewImage(
  imageDataUrl: string,
  width: number,
  height: number,
): Promise<ProcessedPreviewImage> {
  if (
    ![width, height].every(
      (value) => Number.isInteger(value) && value >= 1 && value <= 8192,
    ) ||
    width * height > MAX_PIXELS
  ) {
    throw new PreviewPipelineError('invalid_dimensions');
  }
  if (
    typeof imageDataUrl !== 'string' ||
    !imageDataUrl.startsWith(DATA_URL_PREFIX)
  ) {
    throw new PreviewPipelineError('invalid_image');
  }
  const encoded = imageDataUrl.slice(DATA_URL_PREFIX.length);
  if (encoded.length > Math.ceil(MAX_BYTES / 3) * 4) {
    throw new PreviewPipelineError('image_too_large');
  }
  if (
    !encoded.length ||
    encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  ) {
    throw new PreviewPipelineError('invalid_image');
  }
  if (processingImage) throw new PreviewPipelineError('image_processing_busy');
  processingImage = true;
  try {
    const input = Buffer.from(encoded, 'base64');
    if (input.length > MAX_BYTES)
      throw new PreviewPipelineError('image_too_large');
    if (input.toString('base64') !== encoded)
      throw new PreviewPipelineError('invalid_image');
    validatePngContainer(input);
    const options = {
      limitInputPixels: MAX_PIXELS,
      animated: false,
      failOn: 'warning' as const,
    };
    const metadata = await sharp(input, options).metadata();
    if (metadata.format !== 'png' || (metadata.pages ?? 1) !== 1) {
      throw new PreviewPipelineError('invalid_image');
    }
    if (metadata.width !== width || metadata.height !== height) {
      throw new PreviewPipelineError('invalid_dimensions');
    }
    // Decode/re-encode, never copy optional metadata or untrusted PNG chunks.
    // Do not auto-rotate: normalized diagram bounds refer to this exact canvas.
    const source = await sharp(input, options)
      .toColourspace('srgb')
      .ensureAlpha()
      .png({ compressionLevel: 6, adaptiveFiltering: false })
      .timeout({ seconds: 15 })
      .toBuffer();
    if (source.length > MAX_BYTES)
      throw new PreviewPipelineError('image_too_large');
    const model = await sharp(source, options)
      .resize({
        width: 2048,
        height: 2048,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .png({ compressionLevel: 6, adaptiveFiltering: false })
      .timeout({ seconds: 15 })
      .toBuffer({ resolveWithObject: true });
    if (model.data.length > MAX_BYTES)
      throw new PreviewPipelineError('image_too_large');
    return {
      source,
      modelInput: model.data,
      sourceSHA256: createHash('sha256').update(source).digest('hex'),
      modelInputSHA256: createHash('sha256').update(model.data).digest('hex'),
      width,
      height,
      byteSize: source.length,
      modelInputWidth: model.info.width,
      modelInputHeight: model.info.height,
    };
  } catch (error) {
    if (error instanceof PreviewPipelineError) throw error;
    throw new PreviewPipelineError('invalid_image');
  } finally {
    processingImage = false;
  }
}
