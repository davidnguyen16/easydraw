import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fitPreviewCamera } from './preview-camera-fit';
import { sceneNodeHalfExtents, type DiagramSceneModel, type DiagramSceneNode } from './scene-model';
import { diagramToWorld, type SceneOrientation } from './scene-orientation';

const fov = Math.PI / 4;
const node = (id: string, position: DiagramSceneNode['position'], size: DiagramSceneNode['size'],
  rotation: DiagramSceneNode['rotation'] = [0, 0, 0]): DiagramSceneNode => ({
  id, type: 'CubeNode', kind: 'box', position, size, rotation,
  data: {}, selected: false, locked: false, label: '', details: [], color: '#ffffff', textColor: '#000000',
});
const classroom: DiagramSceneModel = {
  nodes: [node('cuboid', [-3, 4.62, -0.5], [2.49, 9.24, 3.24]),
    node('notes', [3, 5.11, 0.72], [6.9, 0.02, 6.6], [Math.PI / 2, 0, 0])],
  edges: [], center: [0, 4.75, 0.2], origin: [0, 0, 0], radius: 7.7, warnings: [],
};

function projectBounds(model: DiagramSceneModel, orientation: SceneOrientation, aspect: number, direction: THREE.Vector3) {
  const fit = fitPreviewCamera(model, orientation, direction, fov, aspect);
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.001, 1000);
  camera.position.copy(fit.center).addScaledVector(direction.clone().normalize(), fit.distance);
  camera.lookAt(fit.center); camera.updateMatrixWorld(true);
  const projected: THREE.Vector3[] = [];
  for (const item of model.nodes) {
    const half = sceneNodeHalfExtents(item);
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const point = new THREE.Vector3(x * half[0], y * half[1], z * half[2])
        .applyEuler(new THREE.Euler(...item.rotation)).add(new THREE.Vector3(...item.position));
      projected.push(new THREE.Vector3(...diagramToWorld(point.toArray(), orientation)).project(camera));
    }
  }
  for (const edge of model.edges) for (const point of edge.points) {
    projected.push(new THREE.Vector3(...diagramToWorld(point, orientation)).project(camera));
  }
  return { ...fit, projected };
}

describe('responsive standalone camera fit', () => {
  it.each([0.55, 0.8, 1.3, 1.8, 2.6])('fits tall geometry and upright notes inside aspect %s', (aspect) => {
    const result = projectBounds(classroom, 'floor', aspect, new THREE.Vector3(4.2, 4.9, 15));
    for (const point of result.projected) {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(1 / 1.12 + 1e-9);
      expect(Math.abs(point.y)).toBeLessThanOrEqual(1 / 1.12 + 1e-9);
      expect(point.z).toBeLessThan(1);
    }
    // A visible bound should use the available width or height, with margin.
    expect(Math.max(...result.projected.flatMap((point) => [Math.abs(point.x), Math.abs(point.y)])))
      .toBeCloseTo(1 / 1.12, 8);
  });

  it('includes rotated upright nodes and edge points without changing the document', () => {
    const model: DiagramSceneModel = { ...classroom,
      nodes: [node('tilted', [3, 4, -2], [4, 6, 2], [0.2, 0.7, -0.4])],
      edges: [{ points: [[-9, -3, 2], [12, 7, -3]] } as DiagramSceneModel['edges'][number]],
    };
    const before = structuredClone(model);
    const result = projectBounds(model, 'upright', 0.65, new THREE.Vector3(0.45, 0.3, 1.4));
    expect(result.projected.every((point) => Math.abs(point.x) < 1 && Math.abs(point.y) < 1)).toBe(true);
    expect(model).toEqual(before);
  });

  it('avoids the oversized enclosing sphere while keeping a safe near distance', () => {
    const result = projectBounds(classroom, 'floor', 1.8, new THREE.Vector3(4.2, 4.9, 15));
    const previousDistance = classroom.radius / Math.sin(fov / 2) * 1.18;
    expect(result.distance).toBeLessThan(previousDistance * 0.75);
    expect(result.distance).toBeGreaterThan(0.3);
    expect(fitPreviewCamera({ ...classroom, nodes: [] }, 'floor', new THREE.Vector3(), fov, 1).distance)
      .toBeGreaterThan(0);
  });
});
