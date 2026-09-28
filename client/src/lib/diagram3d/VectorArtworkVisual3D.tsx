'use client';

import { useEffect, useMemo } from 'react';
import { Edges, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { DiagramSceneNode } from './scene-model';
import { getFlatArtworkPlan, type FlatArtworkPlan } from './flat-artwork';
import { buildVectorArtworkGeometry, type VectorArtworkPlan } from './vector-geometry';
import FlatArtworkVisual3D from './FlatArtworkVisual3D';

interface Props { node: DiagramSceneNode; selected: boolean }

/** Generic authored paths become solid lines/fills, never inferred subject
 * matter. Original numeric 2D paths remain the source of truth. */
export default function VectorArtworkVisual3D({ node, selected }: Props) {
  const key = JSON.stringify(getFlatArtworkPlan(node));
  const plan = useMemo(() => JSON.parse(key) as FlatArtworkPlan, [key]);
  if (plan.kind !== 'vector') return <FlatArtworkVisual3D node={node} selected={selected} />;
  return <SolidArtwork node={node} plan={plan} selected={selected} />;
}

function SolidArtwork({ node, plan, selected }: Props & { plan: VectorArtworkPlan }) {
  const depth = node.size[1];
  const result = useMemo(() => buildVectorArtworkGeometry(plan, depth), [plan, depth]);
  useEffect(() => () => { for (const part of result.parts) part.geometry.dispose(); }, [result]);
  if (result.fallbackReason) return <group userData={{ vectorGeometryFallback: result.fallbackReason }}>
    <FlatArtworkVisual3D node={node} selected={selected} />
    {selected && <Html center position={[0, depth / 2 + 0.02, 0]} style={{ pointerEvents: 'none' }}>
      <span role="status" data-scene-control="true" className="block max-w-64 rounded bg-white/95 px-2 py-1 text-center text-xs text-[#6b5e55]">
        {result.fallbackReason}
      </span>
    </Html>}
  </group>;
  return <group userData={{ vectorArtwork3D: true, vectorGeometryStats: result.stats }}>
    {result.parts.map((part) => <mesh key={part.paint} geometry={part.geometry} castShadow={node.data.shadow === true} receiveShadow>
      <meshStandardMaterial color={plan.appearance[part.paint]} roughness={0.72} metalness={0.02}
        opacity={plan.opacity} transparent={plan.opacity < 1} depthWrite={plan.opacity >= 0.5}
        side={THREE.DoubleSide} emissive={selected ? '#a6192e' : '#000000'} emissiveIntensity={selected ? 0.12 : 0} />
    </mesh>)}
    {/* Invisible footprint preserves selection inside holes and between lines;
        it is not a visible card or a guessed semantic object. */}
    <mesh>
      <boxGeometry args={node.size} />
      <meshBasicMaterial color="#a6192e" transparent opacity={selected ? 0.035 : 0} depthWrite={false} />
      {selected && <Edges color="#a6192e" lineWidth={1.5} />}
    </mesh>
  </group>;
}
