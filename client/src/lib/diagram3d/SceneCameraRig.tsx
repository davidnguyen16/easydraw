'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useEditorStore } from '@/lib/stores/editor.store';
import { sceneNodeHalfExtents, type DiagramSceneModel, type Vec3 } from './scene-model';
import type { DiagramCamera, DiagramSceneEditing } from './types';
import { registerSceneViewport } from './scene-viewport';
import { waitForDocumentImages, waitForImageReadiness, type ImageReadiness } from '@/lib/exporters/image-readiness';
import { diagramToWorld, worldRayToDiagram, worldToDiagram, type SceneOrientation } from './scene-orientation';

export type CameraPreset = 'fit' | 'isometric' | 'top' | 'front';
export interface ViewRequest { preset: CameraPreset; nonce: number }
export type DropProjector = (clientX: number, clientY: number) => Vec3 | null;

interface Props {
  model: DiagramSceneModel;
  camera?: DiagramCamera;
  onCameraChange: (camera: DiagramCamera) => void;
  view: ViewRequest;
  editing?: DiagramSceneEditing;
  viewportRef: RefObject<HTMLDivElement | null>;
  projectDropRef: RefObject<DropProjector | null>;
  standalone?: boolean;
  orientation?: SceneOrientation;
}

export function SceneCameraRig({ model, camera: storedCamera, onCameraChange, view, editing, viewportRef, projectDropRef, standalone = false, orientation = 'floor' }: Props) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const get = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const initialCamera = useRef(storedCamera);
  const appliedNonce = useRef<number | null>(null);
  const appliedOrientation = useRef<SceneOrientation | null>(null);
  const referenceDistance = useRef(1);
  const previousSize = useRef<{ width: number; height: number } | null>(null);

  const reportCamera = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const { camera, gl } = get();
    gl.domElement.dataset.cameraPosition = JSON.stringify(camera.position.toArray());
    gl.domElement.dataset.cameraTarget = JSON.stringify(controls.target.toArray());
    if (!standalone) useEditorStore.getState().setZoom3d(Math.round(100 * referenceDistance.current / Math.max(camera.position.distanceTo(controls.target), 0.001)));
    onCameraChange({ position: camera.position.toArray() as Vec3, target: controls.target.toArray() as Vec3 });
  }, [get, onCameraChange, standalone]);

  const fit = useCallback((preset: CameraPreset, selectedOnly = false) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const { camera, size } = get();
    let center = new THREE.Vector3(...diagramToWorld(model.center, orientation));
    let radius = model.radius;
    if (selectedOnly && editing) {
      const bounds = new THREE.Box3();
      for (const node of model.nodes) {
        if (!editing.selectedNodeIds.includes(node.id)) continue;
        const rotation = new THREE.Euler(...node.rotation);
        const half = sceneNodeHalfExtents(node);
        for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
          const corner = new THREE.Vector3(x * half[0], y * half[1], z * half[2]).applyEuler(rotation).add(new THREE.Vector3(...node.position));
          bounds.expandByPoint(new THREE.Vector3(...diagramToWorld(corner.toArray(), orientation)));
        }
      }
      for (const edge of model.edges) if (editing.selectedEdgeIds.includes(edge.id)) for (const point of edge.points) bounds.expandByPoint(new THREE.Vector3(...diagramToWorld(point, orientation)));
      if (!bounds.isEmpty()) {
        center = bounds.getCenter(new THREE.Vector3());
        radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.3);
      }
    }
    const fov = camera instanceof THREE.PerspectiveCamera ? THREE.MathUtils.degToRad(camera.fov) : Math.PI / 4;
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.1);
    const limitingFov = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * aspect));
    const distance = Math.max(radius, 0.3) / Math.sin(limitingFov / 2) * 1.18;
    const direction = orientation === 'upright' ? new THREE.Vector3(0.45, 0.3, 1.4) : new THREE.Vector3(1, 0.85, 1.15);
    if (preset === 'top') direction.set(0, 1, 0.0001);
    else if (preset === 'front') direction.set(0, 0, 1);
    else if (preset === 'fit') direction.copy(camera.position).sub(controls.target);
    if (direction.lengthSq() === 0) direction.set(1, 0.85, 1.15);
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction.normalize(), distance);
    referenceDistance.current = distance;
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
    controls.update();
    invalidate();
  }, [editing, get, invalidate, model, orientation]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || appliedNonce.current === view.nonce && appliedOrientation.current === orientation) return;
    const firstRun = appliedNonce.current === null;
    const orientationChanged = !firstRun && appliedOrientation.current !== orientation;
    appliedNonce.current = view.nonce;
    appliedOrientation.current = orientation;
    const { camera, gl } = get();
    camera.up.set(0, 1, 0);
    const saved = firstRun ? initialCamera.current : undefined;
    fit(orientationChanged ? 'isometric' : view.preset);
    if (saved) {
      camera.position.fromArray(saved.position);
      controls.target.fromArray(saved.target);
      camera.lookAt(controls.target);
      controls.update();
    }
    gl.domElement.dataset.cameraPosition = JSON.stringify(camera.position.toArray());
    gl.domElement.dataset.cameraTarget = JSON.stringify(controls.target.toArray());
    if (!standalone) useEditorStore.getState().setZoom3d(Math.round(100 * referenceDistance.current / Math.max(camera.position.distanceTo(controls.target), 0.001)));
    invalidate();
    if (!firstRun) reportCamera();
  }, [fit, get, invalidate, orientation, reportCamera, standalone, view]);

  // Embeds can resize when a notice expands or a narrow tab becomes visible.
  // Refit only on actual dimensions, preserving the current orbit direction;
  // ordinary pan/zoom must not snap back or touch the shared editor viewport.
  useEffect(() => {
    if (!standalone) return;
    const previous = previousSize.current;
    previousSize.current = { width: size.width, height: size.height };
    if (!previous || previous.width === size.width && previous.height === size.height) return;
    fit('fit');
    reportCamera();
  }, [fit, reportCamera, size.width, size.height, standalone]);

  useEffect(() => {
    const { camera } = get();
    camera.near = Math.max(model.radius / 1000, 0.001);
    camera.far = Math.max(model.radius * 100, 1000);
    camera.updateProjectionMatrix();
    invalidate();
  }, [get, invalidate, model.radius]);

  useEffect(() => {
    projectDropRef.current = (clientX, clientY) => {
      const { camera, gl } = get();
      const rect = gl.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2((clientX - rect.left) / Math.max(rect.width, 1) * 2 - 1, -(clientY - rect.top) / Math.max(rect.height, 1) * 2 + 1);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      const point = worldRayToDiagram(raycaster.ray, orientation).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      if (point && point.length() < 100000) return point.toArray() as Vec3;
      const target = controlsRef.current?.target ?? new THREE.Vector3(...diagramToWorld(model.center, orientation));
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), target);
      const fallback = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (!fallback) return null;
      const local = worldToDiagram(fallback.toArray(), orientation);
      return [local[0], 0, local[2]];
    };
    return () => { projectDropRef.current = null; };
  }, [get, model.center, orientation, projectDropRef]);

  useEffect(() => {
    if (standalone) return;
    function setZoom(percent: number) {
      const controls = controlsRef.current;
      if (!controls || !Number.isFinite(percent)) return;
      const { camera } = get();
      const direction = camera.position.clone().sub(controls.target).normalize();
      const distance = THREE.MathUtils.clamp(referenceDistance.current * 100 / THREE.MathUtils.clamp(percent, 1, 10000), controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).addScaledVector(direction, distance);
      controls.update(); invalidate(); reportCamera();
    }
    return registerSceneViewport({
      zoomIn: () => setZoom(useEditorStore.getState().zoom3d * 1.2),
      zoomOut: () => setZoom(useEditorStore.getState().zoom3d / 1.2),
      setZoom,
      fitView: () => { fit('fit'); reportCamera(); },
      fitSelection: () => { fit('fit', true); reportCamera(); },
      exportImage: async () => {
        const root = viewportRef.current;
        if (!root) throw new Error('3D viewport is not mounted');
        const { gl, scene, camera } = get();
        await waitForImageReadiness(() => {
          const states: ImageReadiness[] = [];
          scene.traverse((object) => {
            if (object.userData.customImageReadiness) states.push(object.userData.customImageReadiness as ImageReadiness);
          });
          return states;
        });
        await waitForDocumentImages(root);
        const hidden: THREE.Object3D[] = [];
        scene.traverse((object) => {
          if ('isTransformControls' in object && object.isTransformControls === true && object.visible) { object.visible = false; hidden.push(object); }
        });
        try {
          gl.render(scene, camera);
          const { toPng } = await import('html-to-image');
          return await toPng(root, {
            backgroundColor: '#f8f5ee', pixelRatio: 1.5, skipFonts: true,
            filter: (element) => !(element instanceof HTMLElement && element.dataset.sceneControl === 'true'),
          });
        } finally {
          for (const object of hidden) object.visible = true;
          gl.render(scene, camera);
          invalidate();
        }
      },
    });
  }, [fit, get, invalidate, reportCamera, standalone, viewportRef]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={false}
      minPolarAngle={0.0001}
      maxPolarAngle={Math.PI - 0.0001}
      minDistance={Math.max(model.radius * 0.025, 0.1)}
      maxDistance={Math.max(model.radius * 25, 100)}
      screenSpacePanning
      onEnd={reportCamera}
    />
  );
}
