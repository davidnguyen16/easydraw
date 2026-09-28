'use client';

import { useId } from 'react';
import { isVectorGeometry } from '@easydraw/diagram-schema';
import { artworkDimension, resolveVectorAppearance, vectorArrowSize, vectorPathInBox } from './vector-artwork';

interface Props {
  data: Record<string, unknown>;
  width?: number;
  height?: number;
  className?: string;
}

/** Shared editor/preview artwork. No editor store, handles, or editing effects. */
export default function VectorArtwork({ data, width, height, className = '' }: Props) {
  const markerId = `vector-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const geometry = data.vector;
  if (!isVectorGeometry(geometry)) {
    return <div role="img" aria-label="Invalid vector artwork" data-vector-state="invalid"
      className={`flex h-full w-full items-center justify-center border border-dashed border-[#b39c85] bg-[#faf8f3] text-center text-xs text-[#807367] ${className}`}>Vector unavailable</div>;
  }
  const w = artworkDimension(width, 160);
  const h = artworkDimension(height, 80);
  const appearance = resolveVectorAppearance(geometry, data);
  const arrowVisible = appearance.stroke !== 'none' && appearance.stroke !== 'transparent' && appearance.strokeWidth > 0;
  const arrowSize = vectorArrowSize(appearance.strokeWidth);
  const label = typeof data.label === 'string' && data.label ? data.label : 'Vector artwork';
  return (
    <svg className={`h-full w-full overflow-visible ${className}`} viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none" role="img" aria-label={label} data-vector-state="ready" style={{ opacity: appearance.opacity }}>
      <title>{label}</title>
      {arrowVisible && (geometry.startArrow || geometry.endArrow) && <defs>
        <marker id={markerId} markerUnits="userSpaceOnUse" viewBox="0 0 10 10" refX={9} refY={5}
          markerWidth={arrowSize} markerHeight={arrowSize} orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill={appearance.stroke} />
        </marker>
      </defs>}
      <path data-vector-path="true" d={vectorPathInBox(geometry, w, h)} fill={appearance.fill}
        stroke={appearance.stroke} strokeWidth={appearance.strokeWidth} strokeDasharray={appearance.dashArray}
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        markerStart={arrowVisible && geometry.startArrow ? `url(#${markerId})` : undefined}
        markerEnd={arrowVisible && geometry.endArrow ? `url(#${markerId})` : undefined} />
    </svg>
  );
}
