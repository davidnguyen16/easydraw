import { BadRequestException } from '@nestjs/common';

/** Dashboard previews are small; the editor scales them to ≤ 640 px before upload. */
export const MAX_THUMBNAIL_BYTES = 300 * 1024;
const THUMBNAIL_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg']);

export interface ThumbnailImage {
  type: string;
  /** Owned copy (a fresh ArrayBuffer), the shape Prisma's Bytes column takes. */
  bytes: Uint8Array<ArrayBuffer>;
}

/** Decodes a browser `canvas.toDataURL()` result; anything else is refused. */
export function parseThumbnail(dataUrl: string): ThumbnailImage {
  const match =
    /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match || !THUMBNAIL_TYPES.has(match[1]))
    throw new BadRequestException(
      'Thumbnail must be a WebP, PNG or JPEG data URL.',
    );
  const bytes = new Uint8Array(Buffer.from(match[2], 'base64'));
  if (bytes.length === 0 || bytes.length > MAX_THUMBNAIL_BYTES)
    throw new BadRequestException(
      `Thumbnail must be between 1 byte and ${MAX_THUMBNAIL_BYTES / 1024} KB.`,
    );
  return { type: match[1], bytes };
}

/** HTTP caching for a thumbnail: the URL carries its version, so it can be cached for a day. */
export function thumbnailHeaders(
  type: string,
  at: Date,
): Record<string, string> {
  return {
    'Content-Type': type,
    'Cache-Control': 'private, max-age=86400',
    ETag: `"${at.getTime()}"`,
  };
}
