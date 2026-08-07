import {
  ADDITIONAL_UML_DEFINITION_BY_ID,
  type AdditionalUmlGeometry,
  type AdditionalUmlId,
} from './definitions';

// Palette icon for the additional UML symbols (Port of UmlIcon.svelte).
export default function UmlIcon({ id }: { id: AdditionalUmlId }) {
  const definition = ADDITIONAL_UML_DEFINITION_BY_ID[id];
  const geometry = definition.geometry as AdditionalUmlGeometry;
  const transform = `scale(${definition.defaultWidth / 100} ${definition.defaultHeight / 100})`;
  const viewBox = `0 0 ${definition.defaultWidth} ${definition.defaultHeight}`;
  const surface = 'var(--uml-icon-surface, #fff)';
  const bodyFill = definition.iconFill === 'ink' ? 'currentColor' : surface;
  const markSize = Math.min(definition.defaultWidth, definition.defaultHeight) * 0.22;

  return (
    <svg viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" className="size-[26px] overflow-visible" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g transform={transform}>
        {geometry.kind === 'ellipse' ? (
          <ellipse cx="50" cy="50" rx="49" ry="49" fill={bodyFill} stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        ) : geometry.kind === 'polygon' ? (
          <polygon points={geometry.points} fill={bodyFill} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ) : geometry.kind === 'polygons' ? (
          geometry.items.map((points) => (
            <polygon key={points} points={points} fill={bodyFill} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))
        ) : geometry.kind === 'path' ? (
          <path d={geometry.d} fillRule={geometry.fillRule} fill={bodyFill} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ) : geometry.kind === 'paths' ? (
          geometry.items.map((item) => (
            <path key={item.d} d={item.d} fill={item.filled === false ? 'none' : bodyFill} stroke="currentColor" strokeWidth={1.5} strokeDasharray={item.dash} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))
        ) : geometry.kind === 'bullseye' ? (
          <>
            <circle cx="50" cy="50" r="48" fill={surface} stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <circle cx="50" cy="50" r="22" fill="currentColor" />
          </>
        ) : null}
      </g>

      {definition.iconMark ? (
        <text
          x={definition.defaultWidth / 2}
          y={definition.defaultHeight * 0.18}
          fill="currentColor"
          fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
          fontSize={markSize}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {definition.iconMark}
        </text>
      ) : null}
    </svg>
  );
}
