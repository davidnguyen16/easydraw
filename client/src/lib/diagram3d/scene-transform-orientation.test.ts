import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { DiagramSceneEdge, DiagramSceneNode, Vec3 } from './scene-model';
import type { DiagramSceneEditing, NodeTransform3D } from './types';

const lifecycle = vi.hoisted(() => ({ layout: [] as Array<() => void> }));
vi.mock('react', async (load) => ({
  ...await load<typeof import('react')>(),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useLayoutEffect: (effect: () => void) => { lifecycle.layout.push(effect); },
}));
vi.mock('./NodeVisual3D', () => ({ default: () => null }));
vi.mock('./NodeSurfaceLabel', () => ({ default: () => null }));
vi.mock('./SceneTransformControls', () => ({ SceneTransformControls: () => null }));
vi.mock('@react-three/fiber', () => ({ useThree: () => null }));
vi.mock('@react-three/drei', () => ({ Html: () => null, Line: () => null }));
import { NodeTransformControl } from './SceneNode3D';
import { EdgeEndpointControl, EdgePointControl } from './SceneConnection3D';
import { diagramRotationToWorld } from './scene-orientation';

beforeEach(() => { lifecycle.layout = []; });

const node = (): DiagramSceneNode => ({
  id: 'shape', type: 'RectangleNode', data: {}, label: 'Shape', details: [], selected: true,
  locked: false, kind: 'box', position: [1, 0.2, -3], rotation: [0.2, -0.3, 0.4],
  size: [2, 0.5, 3], color: '#ffffff', textColor: '#000000',
});
const edge = (): DiagramSceneEdge => ({
  id: 'edge', data: {}, selected: true, points: [[1, 0.2, -3], [4, 0.2, 2]], bendPoints: [[3, 0.2, 1]],
  labels: [], color: '#000000', width: 1, dashed: false, lineStyle: 'solid', markerStart: 'none', markerEnd: 'none',
});
function editing(tool: DiagramSceneEditing['tool']): DiagramSceneEditing {
  return { tool, disabled: false, snapToGrid: true, showGrid: true, selectedNodeIds: [], selectedEdgeIds: [],
    onSelectNode: vi.fn(), onSelectEdge: vi.fn(), onClearSelection: vi.fn(), onTransformNode: vi.fn(),
    onConnect: vi.fn(), onDropShape: vi.fn(), onEditNodeLabel: vi.fn(), onEditEdgeLabel: vi.fn(),
    onMoveEdgePoint: vi.fn(), onMoveEdgeEndpoint: vi.fn(),
  };
}

type Control = { object: THREE.Object3D; space: string; translationSnap: number | null;
  onMouseDown: () => void; onObjectChange: () => void; onMouseUp: () => void };
function mount(element: { props: { children: Array<{ props: unknown }> } } | null): Control {
  lifecycle.layout.forEach((effect) => effect());
  return element!.props.children[1].props as Control;
}

describe('world-root transform proxies preserve local diagram edits', () => {
  it('moves upright objects using world-axis snapping and local callbacks', () => {
    const item = node();
    const before = structuredClone(item);
    const callbacks = editing('move');
    const control = mount(NodeTransformControl({ node: item, editing: callbacks, orientation: 'upright' }));
    expect(control.object.position.toArray()).toEqual([1, 3, 0.2]);
    expect(control.space).toBe('world');
    expect(control.translationSnap).toBe(0.1);
    control.onMouseDown();
    control.object.position.set(2, 4, 0.7);
    control.onObjectChange();
    control.onMouseUp();
    expect(callbacks.onTransformNode).toHaveBeenNthCalledWith(1, 'shape', { position: [1, 0.2, -3] }, 'start');
    expect(callbacks.onTransformNode).toHaveBeenNthCalledWith(2, 'shape', { position: [2, 0.7, -4] }, 'update');
    expect(callbacks.onTransformNode).toHaveBeenNthCalledWith(3, 'shape', { position: [2, 0.7, -4] }, 'end');
    expect(item).toEqual(before);
  });

  it('converts a world rotation back to the node-local Euler rotation', () => {
    const callbacks = editing('rotate');
    const control = mount(NodeTransformControl({ node: node(), editing: callbacks, orientation: 'upright' }));
    control.onMouseDown();
    control.object.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.3));
    const expectedWorld = control.object.quaternion.clone();
    control.onObjectChange();
    const patch = vi.mocked(callbacks.onTransformNode).mock.calls[1][1] as NodeTransform3D;
    const reconstructed = new THREE.Quaternion().setFromEuler(new THREE.Euler(...diagramRotationToWorld(patch.rotation!, 'upright')));
    expect(Math.abs(expectedWorld.dot(reconstructed))).toBeCloseTo(1, 12);
  });

  it('scales extrusion without inflating a one-pixel artwork footprint', () => {
    const item = { ...node(), type: 'VectorPathNode', size: [0.01, 0.02, 2] as Vec3 };
    const callbacks = editing('scale');
    const control = mount(NodeTransformControl({ node: item, editing: callbacks, orientation: 'upright' }));
    expect(control.space).toBe('local');
    control.onMouseDown();
    control.object.scale.set(1, 2, 1);
    control.onObjectChange();
    control.onMouseUp();
    expect(callbacks.onTransformNode).toHaveBeenLastCalledWith('shape', { size: [0.01, 0.04, 2] }, 'end');
    expect(control.object.scale.toArray()).toEqual([1, 1, 1]);
    expect(item.size).toEqual([0.01, 0.02, 2]);
  });

  it('converts upright endpoint and bend gizmos back to local connection coordinates', () => {
    const callbacks = editing('move');
    const endpoint = mount(EdgeEndpointControl({ edge: edge(), end: 'source', editing: callbacks, orientation: 'upright' }));
    expect(endpoint.object.position.toArray()).toEqual([1, 3, 0.2]);
    endpoint.onMouseDown();
    endpoint.object.position.set(2, -5, 0.6);
    endpoint.onObjectChange(); endpoint.onMouseUp();
    expect(callbacks.onMoveEdgeEndpoint).toHaveBeenLastCalledWith('edge', 'source', [2, 0.6, 5], 'end');
    lifecycle.layout = [];
    const bend = mount(EdgePointControl({ edge: edge(), index: 0, editing: callbacks, orientation: 'upright' }));
    expect(bend.object.position.toArray()).toEqual([3, -1, 0.2]);
    bend.onMouseDown(); bend.object.position.set(2, -5, 0.6); bend.onObjectChange(); bend.onMouseUp();
    expect(callbacks.onMoveEdgePoint).toHaveBeenLastCalledWith('edge', 0, [2, 0.6, 5], 'end');
  });
});
