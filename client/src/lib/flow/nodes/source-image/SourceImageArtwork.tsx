'use client';

import { useState } from 'react';
import { isSourceImageData } from '@easydraw/diagram-schema';
import { artworkOpacity, safeArtworkColor } from '../vector/vector-artwork';

export const SOURCE_IMAGE_NOTICE = 'Source image — pixels not editable';

/** Only server-produced bounded PNG data is accepted; never fetch model URLs. */
export default function SourceImageArtwork({ data, className = '' }: { data: Record<string, unknown>; className?: string }) {
  const image = data.image;
  const valid = isSourceImageData(image);
  const [decoded, setDecoded] = useState<{ key: string; status: 'ready' | 'error' } | null>(null);
  // A changed payload/expected size immediately becomes loading. Keying the
  // img also prevents an older image event from marking its replacement ready.
  const imageKey = valid ? `${image.width}:${image.height}:${image.dataUrl}` : '';
  const state = !valid ? 'error' : decoded?.key === imageKey ? decoded.status : 'loading';
  const error = state === 'error' ? 'The source image is invalid or could not be decoded at its expected size.' : undefined;
  const borderWidth = typeof data.borderWidth === 'number' && Number.isFinite(data.borderWidth)
    ? Math.max(0, Math.min(12, data.borderWidth)) : 0;
  return (
    <div className={`relative h-full w-full ${className}`} data-source-image-state={state}
      data-custom-image-state={state} data-custom-image-error={error}
      title={valid && image.reason ? `${SOURCE_IMAGE_NOTICE}. ${image.reason}` : SOURCE_IMAGE_NOTICE}
      style={{ opacity: artworkOpacity(data.opacity), backgroundColor: safeArtworkColor(data.fillColor, 'transparent'),
        border: borderWidth ? `${borderWidth}px solid ${safeArtworkColor(data.borderColor, '#2c2c2a')}` : undefined }}>
      {valid && state !== 'error' ? (
        // This private PNG is embedded in the reviewed document, not a remote optimizer request.
        // eslint-disable-next-line @next/next/no-img-element
        <img key={imageKey} src={image.dataUrl} alt={typeof data.label === 'string' ? data.label : 'Preserved source drawing'}
          draggable={false} className="h-full w-full object-fill"
          onLoad={(event) => setDecoded({ key: imageKey,
            status: event.currentTarget.naturalWidth === image.width && event.currentTarget.naturalHeight === image.height ? 'ready' : 'error' })}
          onError={() => setDecoded({ key: imageKey, status: 'error' })} />
      ) : <div role="img" aria-label="Invalid source image" className="flex h-full w-full items-center justify-center border border-dashed border-[#b39c85] bg-[#faf8f3] text-xs text-[#807367]">Source image unavailable</div>}
      {state === 'loading' && <span role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#faf8f3]/80 text-[10px] text-[#807367]">Loading source image…</span>}
      <span className="pointer-events-none absolute top-full left-0 mt-0.5 max-w-full truncate rounded bg-[#faf8f3]/90 px-1 py-0.5 text-[9px] leading-tight text-[#6d6257]">
        {SOURCE_IMAGE_NOTICE}
      </span>
    </div>
  );
}
