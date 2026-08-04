import MarkerGlyph from '../../../edges/MarkerGlyph';
import { MARKER_GLYPHS } from '../../../edges/marker-glyphs';
import type { CardinalityMarker } from './cardinality-preset';

// Palette preview for cardinality presets — connector path + a MarkerGlyph at
// each end, from the same catalog ConnectionEdge uses. Port of
// CardinalityConnectionIcon.svelte.
interface Props {
  markerStart?: CardinalityMarker;
  markerEnd: CardinalityMarker;
}

const markerScale = 0.76;

export default function CardinalityConnectionIcon({ markerStart, markerEnd }: Props) {
  const startGlyph = markerStart ? MARKER_GLYPHS[markerStart] : null;
  const endGlyph = MARKER_GLYPHS[markerEnd];

  return (
    <svg viewBox="0 0 28 26" xmlns="http://www.w3.org/2000/svg" className="size-[26px]" aria-hidden="true">
      <path
        d="M0.8,21.5 L10.5,21.5 Q12,21.5 12,20 L12,6 Q12,4.5 13.5,4.5 L27.2,4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
      {markerStart && startGlyph ? (
        <g transform={`translate(0.8 21.5) rotate(180) scale(${markerScale}) translate(${-startGlyph.refX} -5)`}>
          <MarkerGlyph kind={markerStart} color="currentColor" />
        </g>
      ) : null}
      <g transform={`translate(27.2 4.5) scale(${markerScale}) translate(${-endGlyph.refX} -5)`}>
        <MarkerGlyph kind={markerEnd} color="currentColor" />
      </g>
    </svg>
  );
}
