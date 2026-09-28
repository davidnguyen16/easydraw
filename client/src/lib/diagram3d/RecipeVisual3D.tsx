'use client';

import { useEffect, useMemo } from 'react';
import { Edges } from '@react-three/drei';
import type { Visual3DRecipe } from '@easydraw/diagram-schema';
import type { DiagramSceneNode } from './scene-model';
import { MATERIAL_COLORS as COLORS, buildRecipeGeometry, safeColor as color } from './recipe-geometry';
import { recipeKey } from './visual3d';

const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Draws a node's recipe scaled to the node's box. */
export default function RecipeVisual3D({ node, recipe, selected }: { node: DiagramSceneNode; recipe: Visual3DRecipe; selected: boolean }) {
  // Rebuild only when the recipe's content changes, not on every re-render of the node.
  const key = recipeKey(recipe);
  const geometries = useMemo(() => buildRecipeGeometry(recipe), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { for (const { geometry } of geometries) geometry.dispose(); }, [geometries]);
  const opacity = Math.max(0, Math.min(1, finite(node.data.opacity, 100) / 100));
  const body = color(node.data.fillColor, color(recipe.fill, COLORS.body));
  const fillVisible = node.data.fillColor !== 'transparent' && node.data.fillColor !== 'none';
  return <group scale={node.size}>
    {geometries.map(({ material, color: partColor, geometry }, index) => {
      const tint = material === 'body' ? body : material === 'custom' ? partColor ?? COLORS.custom : COLORS[material];
      const glow = material === 'teal' || material === 'blue' || material === 'screen';
      const alpha = opacity * (material === 'body' && !fillVisible ? 0.04 : 1);
      return <mesh key={`${material}:${partColor ?? ''}:${index}`} geometry={geometry} castShadow={node.data.shadow === true && !glow} receiveShadow>
        <meshStandardMaterial color={tint} roughness={material === 'silver' ? 0.42 : 0.72} metalness={material === 'silver' ? 0.48 : material === 'frame' ? 0.22 : 0.03}
          transparent={alpha < 1} opacity={alpha} depthWrite={alpha >= 0.5}
          emissive={selected ? '#a6192e' : glow ? tint : '#000000'} emissiveIntensity={selected ? 0.08 : glow ? 0.25 : 0}
        />
      </mesh>;
    })}
    {selected && <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color="#a6192e" lineWidth={Math.max(1.5, Math.min(4, finite(node.data.borderWidth, 1.5)))} transparent opacity={opacity} />
    </mesh>}
  </group>;
}
