import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

// Run the rig's lifecycle effects without a DOM/GPU. The returned OrbitControls
// ref is assigned before effects, just as R3F does on commit.
const harness = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  state: {} as Record<string, unknown>,
  setZoom: vi.fn(),
  readEditor: vi.fn(),
  registerViewport: vi.fn(() => vi.fn()),
}));
vi.mock('react', async (load) => ({
  ...await load<typeof import('react')>(),
  useCallback: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
}));
vi.mock('@react-three/fiber', () => ({ useThree: (selector: (state: Record<string, unknown>) => unknown) => selector(harness.state) }));
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null }));
vi.mock('@/lib/stores/editor.store', () => ({ useEditorStore: { getState: harness.readEditor } }));
vi.mock('./scene-viewport', () => ({ registerSceneViewport: harness.registerViewport }));
import { SceneCameraRig } from './SceneCameraRig';
import type { CameraPreset, DropProjector } from './SceneCameraRig';
import type { SceneOrientation } from './scene-orientation';
import { diagramToWorld } from './scene-orientation';
import { sceneNodeHalfExtents, type DiagramSceneModel, type DiagramSceneNode } from './scene-model';
import type { DiagramSceneEditing } from './types';

beforeEach(() => {
  harness.effects = [];
  harness.readEditor.mockReturnValue({ zoom3d: 100, setZoom3d: harness.setZoom });
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const gl = { domElement: { dataset: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }) } };
  const state = { camera, gl, size: { width: 400, height: 300 }, invalidate: vi.fn() };
  harness.state = { ...state, get: () => state };
});

function mountRig(standalone: boolean, orientation: SceneOrientation = 'floor', preset: CameraPreset = 'isometric',
  options: { model?: DiagramSceneModel; editing?: DiagramSceneEditing } = {}) {
  const onCameraChange = vi.fn();
  const projectDropRef = { current: null as DropProjector | null };
  const element = SceneCameraRig({
    standalone, orientation,
    model: options.model ?? { nodes: [], edges: [], warnings: [], center: [0, 0, 0], origin: [0, 0, 0], radius: 2 },
    editing: options.editing,
    view: { preset, nonce: 0 }, onCameraChange,
    viewportRef: { current: null }, projectDropRef,
  });
  const controls = { target: new THREE.Vector3(), update: vi.fn(), minDistance: 0.1, maxDistance: 100 };
  element.props.ref.current = controls;
  const cleanup = harness.effects.map((effect) => effect()).filter((effect): effect is () => void => typeof effect === 'function');
  return { onCameraChange, end: element.props.onEnd as () => void, cleanup, projectDropRef };
}

describe('standalone preview camera isolation', () => {
  it('fits and reports local camera changes without reading/writing editor state or claiming its viewport', () => {
    const mounted = mountRig(true);
    expect(mounted.onCameraChange).not.toHaveBeenCalled();
    mounted.end();
    expect(mounted.onCameraChange).toHaveBeenCalledOnce();
    expect(mounted.onCameraChange.mock.calls[0][0].position.every(Number.isFinite)).toBe(true);
    expect(harness.readEditor).not.toHaveBeenCalled();
    expect(harness.setZoom).not.toHaveBeenCalled();
    expect(harness.registerViewport).not.toHaveBeenCalled();
    mounted.cleanup.forEach((cleanup) => cleanup());
    expect(harness.registerViewport).not.toHaveBeenCalled();
  });

  it('preserves the existing editor zoom and viewport integration by default', () => {
    const mounted = mountRig(false);
    expect(harness.setZoom).toHaveBeenCalled();
    expect(harness.registerViewport).toHaveBeenCalledOnce();
    mounted.end();
    expect(mounted.onCameraChange).toHaveBeenCalledOnce();
    mounted.cleanup.forEach((cleanup) => cleanup());
    expect(harness.registerViewport.mock.results[0].value).toHaveBeenCalledOnce();
  });

  it('projects upright front-view drops back to unchanged diagram coordinates', () => {
    const mounted = mountRig(true, 'upright', 'front');
    const camera = harness.state.camera as THREE.PerspectiveCamera;
    camera.updateMatrixWorld(true);
    const center = mounted.projectDropRef.current!(200, 150)!;
    const upperRight = mounted.projectDropRef.current!(250, 100)!;
    expect(center.every((coordinate) => Math.abs(coordinate) < 1e-12)).toBe(true);
    expect(upperRight[0]).toBeGreaterThan(0);
    expect(upperRight[1]).toBe(0);
    expect(upperRight[2]).toBeLessThan(0);
    expect(harness.readEditor).not.toHaveBeenCalled();
    mounted.cleanup.forEach((cleanup) => cleanup());
    expect(mounted.projectDropRef.current).toBeNull();
  });

  it('fits the visible caps and largest arrowheads of tiny artwork, not only its editable box', () => {
    const node: DiagramSceneNode = { id: 'axis', type: 'VectorPathNode', kind: 'plane', selected: true, locked: false,
      label: 'Axis', details: [], position: [1, 0.04, -2], rotation: [0.1, 0.2, -0.3], size: [0.01, 0.08, 0.01],
      color: '#000000', textColor: '#000000', data: { vector: { strokeWidth: 12, endArrow: true } } };
    const before = structuredClone(node);
    const editing = { selectedNodeIds: ['axis'], selectedEdgeIds: [] } as unknown as DiagramSceneEditing;
    const mounted = mountRig(false, 'upright', 'front', { editing,
      model: { nodes: [node], edges: [], warnings: [], center: node.position, origin: [0, 0, 0], radius: 2 } });
    const viewport = Reflect.get(harness.registerViewport.mock.calls[0], '0') as { fitSelection: () => void };
    viewport.fitSelection();
    const camera = harness.state.camera as THREE.PerspectiveCamera;
    camera.updateMatrixWorld(true);
    const half = sceneNodeHalfExtents(node);
    expect(half[0]).toBeGreaterThan(0.56);
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const local = new THREE.Vector3(x * half[0], y * half[1], z * half[2])
        .applyEuler(new THREE.Euler(...node.rotation)).add(new THREE.Vector3(...node.position));
      const screen = new THREE.Vector3(...diagramToWorld(local.toArray(), 'upright')).project(camera);
      expect(Math.abs(screen.x)).toBeLessThan(1);
      expect(Math.abs(screen.y)).toBeLessThan(1);
    }
    expect(node).toEqual(before);
    mounted.cleanup.forEach((cleanup) => cleanup());
  });
});
