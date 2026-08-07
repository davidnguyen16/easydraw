import MarkerGlyph from '@/lib/flow/edges/MarkerGlyph';
import { MARKER_GLYPHS } from '@/lib/flow/edges/marker-glyphs';
import type { MarkerKind } from '@/lib/flow/edges/types';

/**
 * A line + line-ending glyph preview, shared by the connection panel's
 * Start/End dropdowns (short, mirrored for the start end) and the Line-endings
 * dialog rows (long). Glyph geometry comes from MARKER_GLYPHS, so previews
 * always match what the edge draws. (Port of MarkerPreview.svelte.)
 */
interface Props {
  kind: MarkerKind;
  /** Which end of the line the glyph decorates. 'start' mirrors the svg. */
  end?: 'start' | 'end';
  width?: number;
  color?: string;
}

// Glyphs are authored in a w×10 box; scale slightly up to fill the 12px height.
const SCALE = 1.1;

export default function MarkerPreview({ kind, end = 'end', width = 44, color = '#2c2c2a' }: Props) {
  const t = width - 2;
  const glyph = kind === 'none' ? null : MARKER_GLYPHS[kind];

  return (
    <svg viewBox={`0 0 ${width} 12`} width={width} height={12} aria-hidden="true">
      <g transform={end === 'start' ? `matrix(-1 0 0 1 ${width} 0)` : undefined}>
        <line x1={2} y1={6} x2={t} y2={6} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
        {glyph && kind !== 'none' ? (
          <g transform={`translate(${t - glyph.refX * SCALE}, ${6 - 5 * SCALE}) scale(${SCALE})`}>
            <MarkerGlyph kind={kind} color={color} />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
