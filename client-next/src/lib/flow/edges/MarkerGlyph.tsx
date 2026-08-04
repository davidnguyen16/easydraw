'use client';

/**
 * Renders the SVG primitives of one marker kind from the shared MARKER_GLYPHS
 * geometry. The parent decides the coordinate context: ConnectionEdge mounts
 * this inside a <marker> def, MarkerPreview inside a scaled <g>. Colours
 * resolve here: 'color' → the line colour, 'white' → an opaque mask so the
 * line underneath doesn't show through open glyphs.
 */
import { MARKER_GLYPHS } from './marker-glyphs';
import type { MarkerKind } from './types';

interface Props {
  kind: Exclude<MarkerKind, 'none'>;
  color: string;
}

export default function MarkerGlyph({ kind, color }: Props) {
  const shapes = MARKER_GLYPHS[kind].shapes;

  function fillOf(fill: 'color' | 'white' | 'none'): string {
    if (fill === 'color') return color;
    if (fill === 'white') return '#ffffff';
    return 'none';
  }

  return (
    <>
      {shapes.map((s, i) =>
        s.el === 'path' ? (
          <path
            key={i}
            d={s.d}
            fill={fillOf(s.fill)}
            stroke={s.stroke ? color : 'none'}
            strokeWidth={s.strokeWidth ?? 1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : s.el === 'circle' ? (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill={fillOf(s.fill)}
            stroke={s.stroke ? color : 'none'}
            strokeWidth={s.strokeWidth ?? 1.2}
          />
        ) : (
          <rect
            key={i}
            x={s.x}
            y={s.y}
            width={s.width}
            height={s.height}
            fill={fillOf(s.fill)}
            stroke={s.stroke ? color : 'none'}
            strokeWidth={s.strokeWidth ?? 1.2}
          />
        ),
      )}
    </>
  );
}
