import * as THREE from 'three';
import { sceneNodeHalfExtents, type DiagramSceneModel } from './scene-model';
import { diagramToWorld, type SceneOrientation } from './scene-orientation';

/** Fit the visible rotated bounds, rather than an enclosing sphere. A tall
 * teaching model beside a wide note card otherwise becomes tiny in an embed. */
export function fitPreviewCamera(model: DiagramSceneModel, orientation: SceneOrientation,
  direction: THREE.Vector3, verticalFov: number, aspect: number, padding = 1.12) {
  const points: THREE.Vector3[] = [];
  for (const node of model.nodes) {
    const half = sceneNodeHalfExtents(node);
    const rotation = new THREE.Euler(...node.rotation);
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const corner = new THREE.Vector3(x * half[0], y * half[1], z * half[2])
        .applyEuler(rotation).add(new THREE.Vector3(...node.position));
      points.push(new THREE.Vector3(...diagramToWorld(corner.toArray(), orientation)));
    }
  }
  for (const edge of model.edges) for (const point of edge.points) {
    points.push(new THREE.Vector3(...diagramToWorld(point, orientation)));
  }

  const center = new THREE.Vector3(...diagramToWorld(model.center, orientation));
  const back = direction.clone().normalize();
  if (back.lengthSq() === 0) back.set(0, 0, 1);
  const worldUp = Math.abs(back.y) > 0.999999 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(worldUp, back).normalize();
  const up = new THREE.Vector3().crossVectors(back, right).normalize();
  const verticalTangent = Math.tan(verticalFov / 2);
  const horizontalTangent = verticalTangent * Math.max(aspect, 0.1);
  let distance = 0.3;
  for (const point of points) {
    const relative = point.clone().sub(center);
    const towardCamera = relative.dot(back);
    distance = Math.max(distance, towardCamera + 0.1,
      towardCamera + padding * Math.abs(relative.dot(right)) / horizontalTangent,
      towardCamera + padding * Math.abs(relative.dot(up)) / verticalTangent);
  }
  if (!points.length) distance = Math.max(model.radius, 0.3) / Math.sin(verticalFov / 2) * padding;
  return { center, distance };
}
