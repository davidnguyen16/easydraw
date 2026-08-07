'use client';

import { useState } from 'react';
import type { Axis } from './types';

interface Props {
  kind: 'ghost' | 'solid';
  x: number;
  y: number;
  axis: Axis;
  onPointerDown?: (event: PointerEvent) => void;
}

// Bend-point pill on a connection segment. Ghost = midpoint placeholder,
// solid = a real user bend point. Ported 1:1 from Pill.svelte.
export default function Pill({ kind, x, y, axis, onPointerDown }: Props) {
  // True from pointerdown until the next global pointerup — keeps the
  // "pressed" highlight for the whole drag even after the cursor leaves.
  const [pressing, setPressing] = useState(false);

  // The pill's long edge lies ALONG the segment; the cursor hints the
  // perpendicular drag direction.
  const isHorizontal = axis === 'h';
  const width = isHorizontal ? 26 : 14;
  const height = isHorizontal ? 14 : 26;
  const rx = Math.min(width, height) / 2;

  const pillClass = [
    'origin-center transition-[stroke-opacity,fill,filter] duration-[120ms] ease-[ease]',
    '[stroke-width:1] [pointer-events:bounding-box] [transform-box:fill-box]',
    kind === 'ghost'
      ? 'fill-white stroke-[#9b9991] [stroke-opacity:0.55] hover:[stroke-opacity:1]'
      : 'cursor-move fill-mq-maroon stroke-mq-maroon',
    kind === 'ghost' && (isHorizontal ? 'cursor-ns-resize' : 'cursor-ew-resize'),
    pressing && '[filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.22))]',
    pressing && kind === 'ghost' && '[stroke-opacity:1] [stroke-width:1.5]',
    pressing && kind === 'solid' && 'fill-[#5a1220] stroke-[#5a1220]',
  ]
    .filter(Boolean)
    .join(' ');

  function handlePointerDown(event: React.PointerEvent<SVGRectElement>) {
    // Stop propagation so the gesture never reaches the edge wrapper / canvas.
    event.stopPropagation();
    event.preventDefault();

    setPressing(true);
    const release = () => {
      setPressing(false);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    onPointerDown?.(event.nativeEvent);
  }

  return (
    <rect
      role="button"
      tabIndex={-1}
      aria-label={kind === 'ghost' ? 'Add bend point' : 'Move bend point'}
      x={x - width / 2}
      y={y - height / 2}
      width={width}
      height={height}
      rx={rx}
      className={pillClass}
      onPointerDown={handlePointerDown}
    />
  );
}
