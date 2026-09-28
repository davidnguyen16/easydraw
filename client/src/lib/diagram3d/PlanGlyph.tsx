'use client';

import { useMemo } from 'react';
import type { Visual3DRecipe } from '@easydraw/diagram-schema';
import { planShapes } from './plan-glyph';
import { recipeKey } from './visual3d';

/**
 * A node's 3D object seen from above, for the 2D canvas. Stretches to the
 * node box like the other shape glyphs (the footprint is the node).
 */
export default function PlanGlyph({ recipe, fill, opacity, className }: { recipe: Visual3DRecipe; fill: string; opacity: number; className?: string }) {
  const key = recipeKey(recipe) + fill;
  const shapes = useMemo(() => planShapes(recipe, fill), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <svg className={className} style={{ opacity }} preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
      {shapes.map((shape, index) => {
        const transform = shape.rotate ? `rotate(${shape.rotate} ${shape.cx} ${shape.cy})` : undefined;
        if (shape.kind === 'rect') {
          return <rect key={index} x={shape.cx - shape.w / 2} y={shape.cy - shape.h / 2} width={shape.w} height={shape.h} transform={transform}
            fill={shape.fill} stroke={shape.stroke} strokeWidth={0.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
        }
        if (shape.kind === 'ring') {
          return <ellipse key={index} cx={shape.cx} cy={shape.cy} rx={shape.w / 2 * 0.86} ry={shape.h / 2 * 0.86} transform={transform}
            fill="none" stroke={shape.fill} strokeWidth={Math.max(1.5, Math.min(shape.w, shape.h) * 0.14)} />;
        }
        return <ellipse key={index} cx={shape.cx} cy={shape.cy} rx={shape.w / 2} ry={shape.h / 2} transform={transform}
          fill={shape.fill} stroke={shape.stroke} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  );
}
