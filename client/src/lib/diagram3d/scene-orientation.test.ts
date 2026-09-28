import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Vec3 } from './scene-model';
import {
  diagramRotationToWorld, diagramToWorld, orientationRotation,
  worldRayToDiagram, worldRotationToDiagram, worldToDiagram,
} from './scene-orientation';

const vector = (point: Vec3) => new THREE.Vector3(...point);
const quaternion = (rotation: Vec3) => new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));

describe('whole-scene orientation without document changes', () => {
  it('uses a fixed origin and exact point inverses for every content type', () => {
    const points: Vec3[] = [[0, 0, 0], [1, 2, 3], [-12.25, 0.125, 19.5]];
    const before = structuredClone(points);
    for (const orientation of ['floor', 'upright'] as const) {
      for (const point of points) {
        const world = diagramToWorld(point, orientation);
        expect(worldToDiagram(world, orientation).map((n) => n || 0)).toEqual(point);
        expect(world).not.toBe(point);
        const transformed = vector(point).applyEuler(new THREE.Euler(...orientationRotation(orientation)));
        expect(transformed.distanceTo(vector(world))).toBeLessThan(1e-12);
      }
    }
    expect(points).toEqual(before);
    expect(diagramToWorld([2, 1, -4], 'upright')).toEqual([2, 4, 1]);
  });

  it('keeps labels, shapes and connections in the same rigid coordinate system', () => {
    const position: Vec3 = [3, 0.8, -2];
    const rotation: Vec3 = [0.2, -0.4, 0.1];
    const objectPoint = new THREE.Vector3(0.5, 0.3, -0.75);
    const local = objectPoint.clone().applyEuler(new THREE.Euler(...rotation)).add(vector(position));
    const worldFromSceneGroup = vector(diagramToWorld(local.toArray(), 'upright'));
    const worldFromProxy = objectPoint.clone().applyEuler(new THREE.Euler(...diagramRotationToWorld(rotation, 'upright')))
      .add(vector(diagramToWorld(position, 'upright')));
    expect(worldFromSceneGroup.distanceTo(worldFromProxy)).toBeLessThan(1e-12);
    expect(vector(worldToDiagram(worldFromProxy.toArray(), 'upright')).distanceTo(local)).toBeLessThan(1e-12);
  });

  it('round-trips gizmo rotations as equivalent quaternions without compounding scene rotation', () => {
    for (const rotation of [[0, 0, 0], [0.2, -0.4, 0.1], [Math.PI / 2, Math.PI / 3, -Math.PI / 4]] as Vec3[]) {
      const copy = [...rotation];
      const world = diagramRotationToWorld(rotation, 'upright');
      const local = worldRotationToDiagram(world, 'upright');
      expect(Math.abs(quaternion(local).dot(quaternion(rotation)))).toBeCloseTo(1, 12);
      expect(rotation).toEqual(copy);
    }
  });

  it('maps world-axis gizmo movement to local coordinates, keeping elevation separate from layout', () => {
    const local: Vec3 = [3, 0.8, -2];
    const world = diagramToWorld(local, 'upright');
    // Moving up on screen/world Y changes drawing Z, not its extrusion depth.
    expect(worldToDiagram([world[0], world[1] + 2, world[2]], 'upright')).toEqual([3, 0.8, -4]);
    // Moving toward the camera/world Z changes local elevation only.
    expect(worldToDiagram([world[0], world[1], world[2] + 2], 'upright')).toEqual([3, 2.8, -2]);
  });

  it('intersects pointer rays against local planes for upright dragging without mutating world events', () => {
    const ray = new THREE.Ray(new THREE.Vector3(2, 4, 12), new THREE.Vector3(0, 0, -1));
    const before = ray.clone();
    const localRay = worldRayToDiagram(ray, 'upright');
    const intersection = localRay.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5), new THREE.Vector3());
    expect(intersection?.toArray()).toEqual([2, 1.5, -4]);
    expect(ray.equals(before)).toBe(true);
    expect(worldRayToDiagram(new THREE.Ray(new THREE.Vector3(2, 4, 12), new THREE.Vector3(1, 0, 0)), 'upright')
      .intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3())).toBeNull();
  });

  it('preserves the fitting sphere radius while moving its center to display space', () => {
    const center: Vec3 = [5, 1, -4];
    const point: Vec3 = [-2, 8, 3];
    expect(vector(diagramToWorld(center, 'upright')).distanceTo(vector(diagramToWorld(point, 'upright'))))
      .toBeCloseTo(vector(center).distanceTo(vector(point)), 12);
  });
});
