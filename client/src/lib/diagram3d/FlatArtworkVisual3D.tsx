'use client';

import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Edges, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ImageReadiness } from '@/lib/exporters/image-readiness';
import type { DiagramSceneNode } from './scene-model';
import { getFlatArtworkPlan, paintVectorArtwork, type FlatArtworkPlan } from './flat-artwork';

interface Props { node: DiagramSceneNode; selected: boolean }

/** Explicit planar artwork. Unlike custom library icons it never acquires a
 * platform, billboard, inferred solid or duplicated semantic caption. */
export default function FlatArtworkVisual3D({ node, selected }: Props) {
  const key = JSON.stringify(getFlatArtworkPlan(node));
  const plan = useMemo(() => JSON.parse(key) as FlatArtworkPlan, [key]);
  if (plan.kind === 'vector') return <VectorArtwork plan={plan} selected={selected} />;
  if (plan.kind === 'image') return <SourceArtwork plan={plan} selected={selected} />;
  return <ArtworkPlane plan={plan} selected={selected} readiness={{ state: 'error', error: plan.error }} />;
}

function VectorArtwork({ plan, selected }: { plan: Extract<FlatArtworkPlan, { kind: 'vector' }>; selected: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = plan.textureWidth; canvas.height = plan.textureHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    paintVectorArtwork(context, plan);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 2;
    return result;
  }, [plan]);
  useEffect(() => {
    invalidate();
    return () => texture?.dispose();
  }, [texture, invalidate]);
  return <ArtworkPlane plan={plan} selected={selected} texture={texture ?? undefined}
    readiness={texture ? { state: 'ready' } : { state: 'error', error: 'Canvas artwork could not be rendered.' }} />;
}

function SourceArtwork({ plan, selected }: { plan: Extract<FlatArtworkPlan, { kind: 'image' }>; selected: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  const [loaded, setLoaded] = useState<{ key: string; texture?: THREE.Texture; error?: string }>();
  const key = JSON.stringify([plan.image, plan.textureWidth, plan.textureHeight]);
  useEffect(() => {
    // getFlatArtworkPlan already rejects remote URLs, SVG and over-limit PNGs.
    // The validated embedded crop is the only source assigned to this image.
    const { image: source, textureWidth, textureHeight } = plan;
    const image = new Image();
    let cancelled = false;
    let texture: THREE.Texture | undefined;
    const fail = () => {
      if (cancelled) return;
      setLoaded({ key, error: 'The embedded source image could not be decoded.' });
      invalidate();
    };
    image.onload = () => {
      if (cancelled) return;
      if (image.naturalWidth !== source.width || image.naturalHeight !== source.height) { fail(); return; }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = textureWidth; canvas.height = textureHeight;
        const context = canvas.getContext('2d');
        if (!context) { fail(); return; }
        context.drawImage(image, 0, 0, textureWidth, textureHeight);
        texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 2;
        setLoaded({ key, texture });
        invalidate();
      } catch { fail(); }
    };
    image.onerror = fail;
    image.src = source.dataUrl;
    return () => {
      cancelled = true;
      image.onload = null; image.onerror = null;
      texture?.dispose();
    };
  }, [plan, key, invalidate]);
  const current = loaded?.key === key ? loaded : undefined;
  const readiness: ImageReadiness = current?.error ? { state: 'error', error: current.error }
    : current?.texture ? { state: 'ready' } : { state: 'loading' };
  return <ArtworkPlane plan={plan} selected={selected} texture={current?.texture} readiness={readiness} />;
}

function ArtworkPlane({ plan, selected, texture, readiness }: {
  plan: FlatArtworkPlan; selected: boolean; texture?: THREE.Texture; readiness: ImageReadiness;
}) {
  const width = (plan.width + plan.padding * 2) / 100;
  const height = (plan.height + plan.padding * 2) / 100;
  return <group userData={{ customImageReadiness: readiness, flatArtwork: true }}>
    {/* Plane geometry is both paint and selection target. Its transparent parts
        do not become an opaque card; a visible border appears only on selection. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} color={texture ? '#ffffff' : '#a6192e'} transparent
        opacity={texture ? plan.opacity : 0.08} alphaTest={0.001}
        depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      {selected && <Edges color="#a6192e" lineWidth={1.5} />}
    </mesh>
    {readiness.state !== 'ready' && <Html center position={[0, 0.01, 0]} style={{ pointerEvents: 'none' }}>
      <span role={readiness.state === 'error' ? 'alert' : 'status'} data-scene-control="true"
        className="block whitespace-nowrap rounded bg-white/90 px-2 py-1 text-xs text-[#a6192e]">
        {readiness.state === 'error' ? 'Artwork unavailable' : 'Loading source image…'}
      </span>
    </Html>}
  </group>;
}
