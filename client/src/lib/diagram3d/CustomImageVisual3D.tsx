'use client';

import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Billboard, Edges, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useAssetUrl } from '@/lib/node-library/assets';
import type { ImageReadiness } from '@/lib/exporters/image-readiness';
import type { DiagramSceneNode } from './scene-model';
import type { Visual3DRecipe } from '@easydraw/diagram-schema';
import { containImageSize } from './custom-image-geometry';
import RecipeVisual3D from './RecipeVisual3D';
import { iconLayout, imageStyleOf, type ImageStyle3D } from './icon-layout';

/**
 * An image node in 3D. By default the picture stands up on a platform and
 * turns to face the camera, the way isometric diagram tools present icons;
 * "flat" lays it on the floor instead. A recipe on the node replaces the
 * platform, so any object from the library can carry a logo on top.
 * All artwork and hit geometry live in node space, so rotation/scale stay shared.
 */
/** One slab of a platform: a disc or a block, scaled to the platform box. */
function PlatformLayer({ round, size, height, y, color, scale = 1, metal = false }: {
  round: boolean; size: [number, number, number]; height: number; y: number; color: string; scale?: number; metal?: boolean;
}) {
  return <mesh position={[0, y, 0]} scale={[size[0] * scale, size[1] * height, size[2] * scale]} receiveShadow castShadow>
    {round ? <cylinderGeometry args={[0.5, 0.5, 1, 40]} /> : <boxGeometry args={[1, 1, 1]} />}
    <meshStandardMaterial color={color} roughness={metal ? 0.42 : 0.7} metalness={metal ? 0.3 : 0.03} />
  </mesh>;
}

/** White top, coloured band, dark foot: the platform icons stand on. */
function PlatformBase({ style, size, fill }: { style: Exclude<ImageStyle3D, 'flat'>; size: [number, number, number]; fill: string }) {
  const round = style === 'puck';
  return <group>
    <PlatformLayer round={round} size={size} height={0.62} y={size[1] * 0.19} color={fill} />
    <PlatformLayer round={round} size={size} height={0.3} y={-size[1] * 0.27} color="#3f91be" metal />
    <PlatformLayer round={round} size={size} height={0.08} y={-size[1] * 0.46} color="#0d1823" scale={1.02} />
  </group>;
}

export default function CustomImageVisual3D({ node, base, selected }: { node: DiagramSceneNode; base: Visual3DRecipe | null; selected: boolean }) {
  const assetId = typeof node.data.assetId === 'string' ? node.data.assetId : undefined;
  const asset = useAssetUrl(assetId);
  const invalidate = useThree((state) => state.invalidate);
  const [loaded, setLoaded] = useState<{ url: string; texture?: THREE.Texture; error?: string }>();

  useEffect(() => {
    if (!asset.url) return;
    const url = asset.url;
    let cancelled = false;
    let texture: THREE.Texture | undefined;
    new THREE.TextureLoader().loadAsync(url).then((result) => {
      texture = result;
      if (cancelled) { result.dispose(); return; }
      result.colorSpace = THREE.SRGBColorSpace;
      result.anisotropy = 4;
      setLoaded({ url, texture: result });
      invalidate();
    }).catch(() => {
      if (!cancelled) {
        setLoaded({ url, error: 'This custom image could not be decoded.' });
        invalidate();
      }
    });
    return () => { cancelled = true; texture?.dispose(); };
  }, [asset.url, invalidate]);

  const current = loaded?.url === asset.url ? loaded : undefined;
  const texture = current?.texture;
  const error = !assetId ? 'This custom image has no asset reference.' : asset.error || current?.error;
  const readiness: ImageReadiness = { state: error ? 'error' : texture ? 'ready' : 'loading', error };
  const [width, height, depth] = node.size;
  const opacity = typeof node.data.opacity === 'number' && Number.isFinite(node.data.opacity) ? Math.max(0, Math.min(1, node.data.opacity / 100)) : 1;
  const style = imageStyleOf(node.data, base);
  const status = texture ? null : <Html center position={[0, height / 2 + 0.01, 0]} style={{ pointerEvents: 'none' }}>
    <span role={error ? 'alert' : 'status'} data-scene-control="true" className="block whitespace-nowrap rounded bg-white/90 px-2 py-1 text-xs text-[#a6192e]">
      {error ? 'Image unavailable' : 'Loading image…'}
    </span>
  </Html>;

  if (style === 'flat') {
    const [imageWidth, imageDepth] = containImageSize(width, depth, node.data.intrinsicWidth, node.data.intrinsicHeight);
    return <group userData={{ customImageReadiness: readiness }}>
      {/* A transparent image still has a full, stable selection/connection target. */}
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color={error ? '#a6192e' : '#d8cabb'} transparent opacity={texture ? 0 : 0.14} depthWrite={false} />
        {selected && <Edges color="#a6192e" lineWidth={1.5} />}
      </mesh>
      {texture ? <mesh position={[0, height / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[imageWidth, imageDepth]} />
        <meshBasicMaterial map={texture} transparent opacity={opacity} alphaTest={0.001} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh> : status}
    </group>;
  }

  const layout = iconLayout(node.size, node.data.intrinsicWidth, node.data.intrinsicHeight, base ? 'object' : 'platform');
  const fill = typeof node.data.fillColor === 'string' && node.data.fillColor !== 'transparent' && node.data.fillColor !== 'none' ? node.data.fillColor : '#ffffff';
  const baseNode: DiagramSceneNode = { ...node, size: layout.platformSize, color: fill };

  return <group userData={{ customImageReadiness: readiness }}>
    {/* Footprint: what the selection outlines and connections attach to. */}
    <mesh>
      <boxGeometry args={[width, height, depth]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      {selected && <Edges color="#a6192e" lineWidth={1.5} />}
    </mesh>
    {/* The icon stands above the footprint; this invisible box makes it clickable. */}
    <mesh position={[0, layout.hitCenterY, 0]}>
      <boxGeometry args={[layout.hitWidth, layout.hitHeight, layout.hitDepth]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    <group position={[0, layout.platformCenterY, 0]}>
      {base ? <RecipeVisual3D node={baseNode} recipe={base} selected={false} /> : <PlatformBase style={style} size={layout.platformSize} fill={fill} />}
    </group>
    {texture ? <Billboard position={[0, layout.imageCenterY, 0]} follow>
      <mesh castShadow={node.data.shadow === true}>
        <planeGeometry args={[layout.imageWidth, layout.imageHeight]} />
        <meshBasicMaterial map={texture} transparent opacity={opacity} alphaTest={0.02} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </Billboard> : status}
  </group>;
}
