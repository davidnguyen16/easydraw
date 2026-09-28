'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { DiagramSceneModel } from './scene-model';

/** A single capped shadow map, mounted only when the diagram requests shadows.
 * The transparent receiving plane never blocks diagram selection or edges. */
export function SceneShadowLight({ model }: { model: DiagramSceneModel }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  const span = Math.max(4, Math.min(model.radius * 1.3, 250));
  return <>
    <primitive object={target} position={model.center} />
    <directionalLight target={target}
      position={[model.center[0] + span, model.center[1] + span * 2, model.center[2] + span * 0.8]}
      intensity={2.1} castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0002} shadow-normalBias={0.015}
    >
      <orthographicCamera attach="shadow-camera" args={[-span, span, span, -span, 0.1, span * 8]} />
    </directionalLight>
    <mesh position={[model.center[0], -0.049, model.center[2]]}
      rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => {}}
    >
      <planeGeometry args={[span * 3, span * 3]} />
      <shadowMaterial transparent opacity={0.2} depthWrite={false} />
    </mesh>
  </>;
}
