import { ADDITIONAL_FLOWCHART_DEFINITIONS } from './definitions';

// Palette icon for the additional flowchart symbols (Port of FlowchartIcon.svelte).
export default function FlowchartIcon({ id }: { id: string }) {
  const definition = ADDITIONAL_FLOWCHART_DEFINITIONS.find((d) => d.id === id);
  if (!definition) throw new Error(`Unknown additional flowchart icon: ${id}`);

  const geometry = definition.geometry;
  const transform = `scale(${definition.defaultWidth / 100} ${definition.defaultHeight / 100})`;
  const viewBox =
    id === 'AnnotationNode'
      ? `0 0 ${definition.defaultWidth * 0.3} ${definition.defaultHeight}`
      : `0 0 ${definition.defaultWidth} ${definition.defaultHeight}`;
  const strokeWidth = id === 'MultipleDocumentsNode' ? 1.2 : 1.5;
  const surface = 'var(--flowchart-icon-surface, #fff)';

  return (
    <svg viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" className="size-[26px] overflow-visible" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g transform={transform}>
        {geometry.kind === 'polygon' ? (
          <polygon points={geometry.points} fill={surface} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ) : geometry.kind === 'path' ? (
          <path d={geometry.d} fillRule={geometry.fillRule} fill={surface} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ) : geometry.kind === 'paths' ? (
          geometry.items.map((item) => (
            <path key={item.d} d={item.d} fill={item.filled === false ? 'none' : surface} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))
        ) : geometry.kind === 'ellipse' ? (
          <ellipse cx="50" cy="50" rx="49.5" ry="49.5" fill={surface} stroke="currentColor" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
        ) : null}
      </g>
    </svg>
  );
}
