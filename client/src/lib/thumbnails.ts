import { API_URL } from '@/lib/api';

/** Dashboard cards are 4:3 and at most a few hundred pixels wide. */
export const THUMBNAIL_MAX_WIDTH = 640;
export const THUMBNAIL_MAX_HEIGHT = 480;

/** WebP where the browser encodes it (Safari falls back to PNG on `image/webp`), else JPEG. */
export function encodeThumbnail(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', 0.8);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.8);
}

/** Scales a canvas down to the thumbnail box; a canvas already small enough is encoded as is. */
export function shrinkCanvas(source: HTMLCanvasElement, maxWidth = THUMBNAIL_MAX_WIDTH, maxHeight = THUMBNAIL_MAX_HEIGHT): HTMLCanvasElement {
  const scale = Math.min(1, maxWidth / Math.max(1, source.width), maxHeight / Math.max(1, source.height));
  if (scale === 1) return source;
  const target = document.createElement('canvas');
  target.width = Math.max(1, Math.round(source.width * scale));
  target.height = Math.max(1, Math.round(source.height * scale));
  const ctx = target.getContext('2d');
  if (!ctx) return source;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.drawImage(source, 0, 0, target.width, target.height);
  return target;
}

/** Sends a document's preview; a failure is silent because a preview is a nicety, not the save. */
export async function uploadThumbnail(diagramId: string, image: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/diagrams/${diagramId}/thumbnail`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
