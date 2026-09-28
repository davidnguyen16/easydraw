import * as THREE from 'three';
import type { Vec3 } from './scene-model';

export type SceneOrientation = 'floor' | 'upright';

/** View-only rotation about a fixed origin. Never rotate around live bounds:
 * their center changes during edits and would make unrelated objects drift. */
export function orientationRotation(orientation: SceneOrientation): Vec3 {
  return orientation === 'upright' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
}

export function diagramToWorld(point: readonly number[], orientation: SceneOrientation): Vec3 {
  return orientation === 'upright' ? [point[0], -point[2], point[1]] : [point[0], point[1], point[2]];
}

export function worldToDiagram(point: readonly number[], orientation: SceneOrientation): Vec3 {
  return orientation === 'upright' ? [point[0], point[2], -point[1]] : [point[0], point[1], point[2]];
}

export function worldRayToDiagram(ray: THREE.Ray, orientation: SceneOrientation): THREE.Ray {
  return new THREE.Ray(
    new THREE.Vector3(...worldToDiagram(ray.origin.toArray(), orientation)),
    new THREE.Vector3(...worldToDiagram(ray.direction.toArray(), orientation)),
  );
}

function rotateEuler(rotation: Vec3, angle: number): Vec3 {
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
  quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle));
  const result = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
  return [result.x, result.y, result.z];
}

export function diagramRotationToWorld(rotation: Vec3, orientation: SceneOrientation): Vec3 {
  return orientation === 'upright' ? rotateEuler(rotation, Math.PI / 2) : [...rotation];
}

export function worldRotationToDiagram(rotation: Vec3, orientation: SceneOrientation): Vec3 {
  return orientation === 'upright' ? rotateEuler(rotation, -Math.PI / 2) : [...rotation];
}
