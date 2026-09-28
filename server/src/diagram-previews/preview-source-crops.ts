import sharp from 'sharp';
import {
  isWhiteboardDiagramDraftV2,
  isSourceImageData,
  SOURCE_IMAGE_NODE_TYPE,
  type PagedDiagramData,
  type SourceImageData,
  type WhiteboardDiagramDraft,
  type DraftWarning,
} from '@easydraw/diagram-schema';
import type { ProcessedPreviewImage } from './preview-image';
import { PreviewPipelineError } from './preview-provider.service';

// At most one crop batch per process, sequential (no unbounded decoder queue).
// Source bytes were fully validated/re-encoded by processPreviewImage already.
let processingCrops = false;
const MAX_DATA_URL_LENGTH = 180_000;
const PNG_PREFIX = 'data:image/png;base64,';

/** A small, self-contained pixel fallback. The original remains in private S3.
 * No AI-supplied URLs, bytes, file paths or SVG markup can enter this function.
 * Inline thumbnails deliberately survive source-preview expiry; deleting the
 * preview/document deletes its copies without a new asset lifecycle or migration.
 */
export async function buildPreviewSourceCrops(
  draft: WhiteboardDiagramDraft,
  source: ProcessedPreviewImage,
  previousDocument?: PagedDiagramData,
): Promise<ReadonlyMap<string, SourceImageData>> {
  const images = new Map<string, SourceImageData>();
  if (draft.version !== 2) return images;
  if (!isWhiteboardDiagramDraftV2(draft))
    throw new PreviewPipelineError('invalid_draft');
  if (!draft.crops.length) return images;
  if (processingCrops) throw new PreviewPipelineError('image_processing_busy');
  processingCrops = true;
  try {
    // Only the authorized, server-stored parent is allowed here. Reusing its
    // bytes makes moving a picture independent of its original image region,
    // even if the current sketch has changed. No parent asset/URL is fetched.
    const previousImages = new Map(
      previousDocument?.pages
        .flatMap((page) => page.nodes)
        .filter((node) => node.type === SOURCE_IMAGE_NODE_TYPE)
        .map((node) => [node.id, node.data?.image] as const),
    );
    for (const crop of draft.crops) {
      if (previousImages.has(crop.id)) {
        const previous = previousImages.get(crop.id);
        if (!isSourceImageData(previous))
          throw new PreviewPipelineError('invalid_document');
        images.set(crop.id, { ...previous });
        continue;
      }
      const left = Math.floor((crop.bounds.x * source.width) / 1000);
      const top = Math.floor((crop.bounds.y * source.height) / 1000);
      const right = Math.min(
        source.width,
        Math.ceil(((crop.bounds.x + crop.bounds.width) * source.width) / 1000),
      );
      const bottom = Math.min(
        source.height,
        Math.ceil(
          ((crop.bounds.y + crop.bounds.height) * source.height) / 1000,
        ),
      );
      const pipeline = sharp(source.source, {
        limitInputPixels: 16_000_000,
        animated: false,
        failOn: 'warning',
      })
        .extract({ left, top, width: right - left, height: bottom - top })
        .resize({
          width: 512,
          height: 512,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toColourspace('srgb')
        .ensureAlpha();
      let result = await pipeline
        .png({ compressionLevel: 6 })
        .timeout({ seconds: 15 })
        .toBuffer({ resolveWithObject: true });
      // Bound the stored/transported representation even for photographic noise.
      for (const size of [256, 128]) {
        if (
          PNG_PREFIX.length + 4 * Math.ceil(result.data.length / 3) <=
          MAX_DATA_URL_LENGTH
        )
          break;
        result = await sharp(result.data, { limitInputPixels: 512 * 512 })
          .resize({
            width: size,
            height: size,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .png({ compressionLevel: 6 })
          .timeout({ seconds: 5 })
          .toBuffer({ resolveWithObject: true });
      }
      const image: SourceImageData = {
        version: 1,
        dataUrl: PNG_PREFIX + result.data.toString('base64'),
        width: result.info.width,
        height: result.info.height,
        reason: crop.reason,
      };
      if (!isSourceImageData(image))
        throw new PreviewPipelineError('invalid_document');
      images.set(crop.id, image);
    }
    return images;
  } catch (error) {
    if (error instanceof PreviewPipelineError) throw error;
    throw new PreviewPipelineError('invalid_image');
  } finally {
    processingCrops = false;
  }
}

/** The server makes fallback provenance visible even if the model omitted it. */
export function previewWarnings(draft: WhiteboardDiagramDraft): DraftWarning[] {
  const retained: DraftWarning[] =
    draft.version === 2
      ? draft.crops.map((crop) => ({
          code: 'unsupported-content',
          elementId: crop.id,
          message:
            `Retained as source image; individual pixels are not editable. ${crop.reason}`.slice(
              0,
              500,
            ),
        }))
      : [];
  return [
    ...retained,
    ...draft.warnings.map((warning) => ({ ...warning })),
  ].slice(0, 30);
}
