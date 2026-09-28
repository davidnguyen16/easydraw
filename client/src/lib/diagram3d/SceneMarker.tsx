'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { MARKER_GLYPHS, type GlyphShape } from '@/lib/flow/edges/marker-glyphs';
import type { MarkerKind } from '@/lib/flow/edges/types';
import type { Vec3 } from './scene-model';

/** All existing marker paths use only absolute M/L/Z commands. */
function pathSections(path: string): THREE.Vector2[][] {
  const tokens = path.match(/[MLZ]|-?\d+(?:\.\d+)?/gi) ?? [];
  const sections: THREE.Vector2[][] = [];
  let current: THREE.Vector2[] = [];
  let command = 'M';
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i];
    if (/^[MLZ]$/i.test(token)) {
      command = token.toUpperCase();
      i += 1;
      if (command === 'Z' && current.length) current.push(current[0].clone());
      continue;
    }
    const x = Number(tokens[i]);
    const y = Number(tokens[i + 1]);
    i += 2;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (command === 'M') {
      current = [];
      sections.push(current);
      command = 'L';
    }
    current.push(new THREE.Vector2(x, -y));
  }
  return sections.filter((section) => section.length > 1);
}

function GlyphPart({ glyph, color }: { glyph: GlyphShape; color: string }) {
  const paths = useMemo(() => {
    if (glyph.el === 'path') return pathSections(glyph.d);
    if (glyph.el === 'rect') {
      const { x, y, width, height } = glyph;
      return [[
        new THREE.Vector2(x, -y), new THREE.Vector2(x + width, -y),
        new THREE.Vector2(x + width, -y - height), new THREE.Vector2(x, -y - height),
        new THREE.Vector2(x, -y),
      ]];
    }
    return [Array.from({ length: 25 }, (_, index) => {
      const angle = index * Math.PI * 2 / 24;
      return new THREE.Vector2(glyph.cx + Math.cos(angle) * glyph.r, -glyph.cy + Math.sin(angle) * glyph.r);
    })];
  }, [glyph]);
  const shapes = useMemo(() => paths.map((path) => new THREE.Shape(path)), [paths]);
  return paths.map((path, index) => (
    <group key={index}>
      {glyph.fill !== 'none' && (
        <mesh>
          <shapeGeometry args={[shapes[index]]} />
          <meshBasicMaterial color={glyph.fill === 'white' ? '#fffdf8' : color} side={THREE.DoubleSide} />
        </mesh>
      )}
      {glyph.stroke && (
        <Line
          points={path.map((point): Vec3 => [point.x, point.y, 0.025])}
          color={color}
          lineWidth={glyph.strokeWidth ?? 1.2}
        />
      )}
    </group>
  ));
}

/** Keeps source/target marker shapes recognizable from every orbit angle. */
export function SceneMarker({ kind, point, adjacent, color }: {
  kind: string;
  point: Vec3;
  adjacent: Vec3;
  color: string;
}) {
  const group = useRef<THREE.Group>(null);
  const basis = useMemo(() => ({
    x: new THREE.Vector3().fromArray(point).sub(new THREE.Vector3().fromArray(adjacent)).normalize(),
    y: new THREE.Vector3(), z: new THREE.Vector3(), matrix: new THREE.Matrix4(),
    position: new THREE.Vector3().fromArray(point),
  }), [point, adjacent]);
  useFrame(({ camera }) => {
    if (!group.current || basis.x.lengthSq() === 0) return;
    basis.z.copy(camera.position).sub(basis.position).normalize();
    basis.y.crossVectors(basis.z, basis.x);
    if (basis.y.lengthSq() < 0.00001) basis.y.set(0, 1, 0).cross(basis.x);
    if (basis.y.lengthSq() < 0.00001) basis.y.set(1, 0, 0).cross(basis.x);
    basis.y.normalize();
    basis.z.crossVectors(basis.x, basis.y).normalize();
    group.current.quaternion.setFromRotationMatrix(basis.matrix.makeBasis(basis.x, basis.y, basis.z));
  });
  const key = kind === 'arrowclosed' ? 'triangle' : kind;
  const glyph = Object.prototype.hasOwnProperty.call(MARKER_GLYPHS, key)
    ? MARKER_GLYPHS[key as Exclude<MarkerKind, 'none'>]
    : undefined;
  if (!glyph) return null;
  return (
    <group ref={group} position={point} scale={0.022}>
      <group position={[-glyph.refX, 5, 0]}>
        {glyph.shapes.map((shape, index) => <GlyphPart key={index} glyph={shape} color={color} />)}
      </group>
    </group>
  );
}
