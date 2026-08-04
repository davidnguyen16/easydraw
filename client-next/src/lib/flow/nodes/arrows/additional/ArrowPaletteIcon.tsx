import { ADDITIONAL_ARROW_DEFINITION_BY_ID, type AdditionalArrowId } from './definitions';

// Palette icon for the additional arrows — same normalized geometry ShapeNode
// draws on the canvas. Port of ArrowPaletteIcon.svelte.
export default function ArrowPaletteIcon({ shapeId }: { shapeId: AdditionalArrowId }) {
  const definition = ADDITIONAL_ARROW_DEFINITION_BY_ID[shapeId];
  const geometry = definition.geometry;
  const viewBox = `0 0 ${definition.defaultWidth} ${definition.defaultHeight}`;
  const transform = `scale(${definition.defaultWidth / 100} ${definition.defaultHeight / 100})`;

  return (
    <svg viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" className="size-[26px] overflow-visible" aria-hidden="true">
      <g transform={transform}>
        {geometry.kind === 'polygon' ? (
          <polygon points={geometry.points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ) : (
          <path d={geometry.d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        )}
      </g>
    </svg>
  );
}
