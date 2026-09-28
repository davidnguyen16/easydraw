'use client';

import { useEffect, useMemo } from 'react';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import type { DiagramSceneNode } from './scene-model';
import { getNodeVisualDefinition } from './visual-catalog';
import { buildGlyphGeometry } from './svg-geometry';
import CustomImageVisual3D from './CustomImageVisual3D';
import RecipeVisual3D from './RecipeVisual3D';
import { getVisual3DRecipe } from './visual3d';
import FlatArtworkVisual3D from './FlatArtworkVisual3D';
import VectorArtworkVisual3D from './VectorArtworkVisual3D';

interface Props { node: DiagramSceneNode; selected: boolean }
const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
function safeColor(value: unknown, fallback: string) {
  return typeof value === 'string' && /^(#[\da-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d\s.,%+-]+\))$/i.test(value)
    && !['none', 'transparent', 'currentcolor', 'inherit'].includes(value.toLowerCase()) ? value : fallback;
}

/** Origin-centred visuals only. Scene owns transforms, editing, and labels. */
export default function NodeVisual3D({ node, selected }: Props) {
  const { type, data } = node;
  const fieldCount = Array.isArray(data.fields) ? data.fields.length : 0;
  const definition = useMemo(() => getNodeVisualDefinition(type, {
    rounded: data.rounded,
    weak: data.weak,
    fields: Array.from({ length: Math.min(fieldCount, 100) }),
  }), [type, data.rounded, data.weak, fieldCount]);
  const opacity = Math.max(0, Math.min(1, finite(data.opacity, 100) / 100));
  const borderWidth = Math.max(0, Math.min(10, finite(data.borderWidth, 1.5)));
  const borderColor = selected ? '#a6192e' : safeColor(data.borderColor, '#2c2c2a');
  const accent = safeColor(data.accentColor, '#a6192e');
  // Entity fill applies to its printed header; the field body stays white in 2D.
  const surface = type === 'EntityNode' || type === 'WeakEntityNode' ? '#ffffff' : node.color;
  const soft = useMemo(() => new THREE.Color(surface).lerp(new THREE.Color(accent), 0.11).getStyle(), [surface, accent]);
  const muted = useMemo(() => new THREE.Color(surface).lerp(new THREE.Color(borderColor), 0.48).getStyle(), [surface, borderColor]);
  const parts = useMemo(() => definition.svg
    ? buildGlyphGeometry(definition.svg, definition.viewBox ?? [0, 0, 100, 100], borderWidth / 1.5) : [], [definition, borderWidth]);
  useEffect(() => () => { for (const part of parts) part.geometry.dispose(); }, [parts]);
  const paint = (role: string) => role === 'surface' ? surface : role === 'accent' ? accent : role === 'accent-soft' ? soft : role === 'muted' ? muted : borderColor;
  const fillVisible = type === 'EntityNode' || type === 'WeakEntityNode' || data.fillColor !== 'transparent' && data.fillColor !== 'none';
  const material = (color = surface, alpha = opacity) => <meshStandardMaterial
    color={color} roughness={0.68} metalness={0.04} opacity={alpha} transparent={alpha < 1}
    depthWrite={alpha >= 0.5} side={THREE.DoubleSide}
    emissive={selected ? '#a6192e' : '#000000'} emissiveIntensity={selected ? 0.08 : 0}
  />;
  const outline = borderWidth > 0 || selected ? <Edges threshold={28} color={borderColor} lineWidth={selected ? Math.max(1.5, borderWidth) : borderWidth} transparent opacity={opacity} /> : null;
  const [width, height, depth] = node.size;

  const recipe = getVisual3DRecipe(type, data);
  if (definition.kind === 'vector-artwork') return <VectorArtworkVisual3D node={node} selected={selected} />;
  if (definition.kind === 'flat-artwork') return <FlatArtworkVisual3D node={node} selected={selected} />;
  if (definition.kind === 'image') return <CustomImageVisual3D node={node} base={recipe} selected={selected} />;
  if (recipe) return <RecipeVisual3D node={node} recipe={recipe} selected={selected} />;

  if (definition.kind === 'svg') return <group rotation={[-Math.PI / 2, 0, 0]} scale={[width, -depth, height]}>
    {parts.map((part, index) => <mesh key={index} geometry={part.geometry} castShadow={data.shadow === true} receiveShadow>
      {material(paint(part.role), opacity * part.opacity * (part.role === 'surface' && !fillVisible ? 0.04 : 1))}
      {part.outline && outline}
    </mesh>)}
    {definition.marks?.map((mark, index) => <GlyphMark key={index} mark={mark} viewBox={definition.viewBox ?? [0, 0, 100, 100]} color={accent} opacity={opacity} />)}
  </group>;

  if (definition.kind === 'text') return <mesh scale={node.size}>
    {/* Transparent hit surface lets blank text be selected; scene owns editable text. */}
    <boxGeometry args={[1, 1, 1]} />
    <meshBasicMaterial transparent opacity={selected ? 0.08 : 0} color={borderColor} depthWrite={false} />
    {selected && outline}
  </mesh>;

  if (definition.kind === 'actor') return <group scale={node.size}>
    <mesh position={[0, 0.34, 0]} scale={[0.26, 0.26, 0.26]} castShadow={data.shadow === true} receiveShadow><sphereGeometry args={[0.5, 16, 12]} />{material()}</mesh>
    {[
      { position: [0, 0, 0], length: 0.45, angle: 0 },
      { position: [-0.2, 0.04, 0], length: 0.45, angle: -Math.PI / 2.5 },
      { position: [0.2, 0.04, 0], length: 0.45, angle: Math.PI / 2.5 },
      { position: [-0.13, -0.32, 0], length: 0.4, angle: -Math.PI / 4 },
      { position: [0.13, -0.32, 0], length: 0.4, angle: Math.PI / 4 },
    ].map((limb, index) => <mesh key={index} position={limb.position as [number, number, number]} rotation={[0, 0, limb.angle]} castShadow={data.shadow === true} receiveShadow>
      <cylinderGeometry args={[0.04, 0.04, limb.length, 10]} />{material(borderColor)}
    </mesh>)}
  </group>;

  return <mesh scale={node.size} castShadow={data.shadow === true} receiveShadow>
    {definition.kind === 'sphere' ? <sphereGeometry args={[0.5, 24, 16]} />
      : definition.kind === 'cylinder' ? <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
        : <boxGeometry args={[1, 1, 1]} />}
    {material(surface, fillVisible ? opacity : 0.04)}
    {outline}
  </mesh>;
}

/** Local catalog marks (L2/L3/NAT), baked without external fonts or assets. */
function GlyphMark({ mark, viewBox, color, opacity }: {
  mark: { x: number; y: number; text: string; fontSize: number };
  viewBox: [number, number, number, number]; color: string; opacity: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
      context.clearRect(0, 0, 128, 64); context.fillStyle = color; context.font = 'bold 40px sans-serif';
      context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(mark.text, 64, 32, 124);
    }
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    return result;
  }, [mark.text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  const [x, y, width, height] = viewBox;
  return <mesh position={[(mark.x - x) / width - 0.5, (mark.y - y) / height - 0.5, 0.498]} scale={[1, -1, 1]}>
    <planeGeometry args={[mark.fontSize * Math.max(1.5, mark.text.length * 0.7) / width, mark.fontSize * 1.5 / height]} />
    <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
  </mesh>;
}
