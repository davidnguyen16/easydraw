'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { DiagramSceneNode, Vec3 } from './scene-model';
import type { DiagramSceneEditing, NodeTransform3D } from './types';
import NodeVisual3D from './NodeVisual3D';
import NodeSurfaceLabel from './NodeSurfaceLabel';
import { SceneTransformControls } from './SceneTransformControls';
import { diagramRotationToWorld, diagramToWorld, worldRayToDiagram, worldRotationToDiagram, worldToDiagram, type SceneOrientation } from './scene-orientation';

interface Props {
  node: DiagramSceneNode;
  selected: boolean;
  editing?: DiagramSceneEditing;
  connecting: boolean;
  onSelect: (id: string, additive: boolean, handle?: string) => void;
  orientation?: SceneOrientation;
}

type CaptureTarget = { setPointerCapture(id: number): void; releasePointerCapture(id: number): void };
type Drag = { start: THREE.Vector3; plane: THREE.Plane; position: Vec3; latestPosition: Vec3; screenX: number; screenY: number; moved: boolean };

export function SceneNode3D({ node, selected, editing, connecting, onSelect, orientation = 'floor' }: Props) {
  const get = useThree((state) => state.get);
  const drag = useRef<Drag | null>(null);
  const callbacksRef = useRef(editing);
  useLayoutEffect(() => { callbacksRef.current = editing; }, [editing]);
  const editable = Boolean(editing && !editing.disabled && !node.locked);
  const canEditLabel = editable && !connecting && editing?.tool !== 'connect' && editing?.tool !== 'orbit';
  const [editingLabel, setEditingLabel] = useState(false);
  const showHandles = !editing?.disabled && (editing?.tool === 'connect' || connecting);

  // A label editor belongs to this selection only. It must not reappear after
  // selecting another object or leaving a read-only/tool mode.
  if (editingLabel && (!selected || !canEditLabel)) setEditingLabel(false);

  const orbit = (enabled: boolean) => {
    const controls = get().controls as unknown as { enabled: boolean } | null;
    if (controls) controls.enabled = enabled;
  };

  useEffect(() => {
    const finish = () => {
      const pending = drag.current;
      if (!pending) return;
      drag.current = null;
      const controls = get().controls as unknown as { enabled: boolean } | null;
      if (controls) controls.enabled = true;
      if (pending.moved) callbacksRef.current?.onTransformNode(node.id, { position: pending.latestPosition }, 'end');
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') finish(); };
    window.addEventListener('blur', finish);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('blur', finish);
      window.removeEventListener('keydown', escape);
      finish();
    };
  }, [get, node.id]);

  function pointerDown(event: ThreeEvent<PointerEvent>) {
    if (event.button !== 0 || !editable || connecting || (editing?.tool !== 'select' && editing?.tool !== 'move')) return;
    event.stopPropagation();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -node.position[1]);
    const intersection = worldRayToDiagram(event.ray, orientation).intersectPlane(plane, new THREE.Vector3());
    if (!intersection) return;
    drag.current = { start: intersection.clone(), plane, position: [...node.position], latestPosition: [...node.position], screenX: event.clientX, screenY: event.clientY, moved: false };
    orbit(false);
    (event.target as unknown as CaptureTarget).setPointerCapture(event.pointerId);
  }

  function pointerMove(event: ThreeEvent<PointerEvent>) {
    const pending = drag.current;
    if (!pending || !editing) return;
    event.stopPropagation();
    if (!pending.moved && Math.hypot(event.clientX - pending.screenX, event.clientY - pending.screenY) < 4) return;
    const intersection = worldRayToDiagram(event.ray, orientation).intersectPlane(pending.plane, new THREE.Vector3());
    if (!intersection) return;
    if (!pending.moved) {
      pending.moved = true;
      if (!selected) editing.onSelectNode(node.id, event.shiftKey || event.metaKey || event.ctrlKey);
      editing.onTransformNode(node.id, { position: pending.position }, 'start');
    }
    const position = intersection.sub(pending.start).add(new THREE.Vector3(...pending.position)).toArray() as Vec3;
    if (editing.snapToGrid) { position[0] = Math.round(position[0] * 10) / 10; position[2] = Math.round(position[2] * 10) / 10; }
    pending.latestPosition = position;
    editing.onTransformNode(node.id, { position }, 'update');
  }

  function pointerUp(event: ThreeEvent<PointerEvent>) {
    const pending = drag.current;
    if (!pending) return;
    event.stopPropagation();
    drag.current = null;
    orbit(true);
    (event.target as unknown as CaptureTarget).releasePointerCapture(event.pointerId);
    if (pending.moved && editing) {
      editing.onTransformNode(node.id, { position: pending.latestPosition }, 'end');
    }
  }

  const [width, height, depth] = node.size;
  const ports: { id: string; position: Vec3 }[] = [
    { id: 'left', position: [-width / 2 - 0.08, 0, 0] },
    { id: 'right', position: [width / 2 + 0.08, 0, 0] },
    { id: 'top', position: [0, 0, -depth / 2 - 0.08] },
    { id: 'bottom', position: [0, 0, depth / 2 + 0.08] },
  ];
  return (
    <group
      position={node.position}
      rotation={node.rotation}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      onClick={(event) => {
        event.stopPropagation();
        if (event.delta > 3) return;
        onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!canEditLabel || event.delta > 3) return;
        onSelect(node.id, false);
        setEditingLabel(true);
      }}
      onContextMenu={(event) => {
        event.stopPropagation(); event.nativeEvent.preventDefault();
        editing?.onContextMenu?.('node', node.id, event.clientX, event.clientY);
      }}
    >
      <NodeVisual3D node={node} selected={selected} />
      <NodeSurfaceLabel node={node} />
      {editingLabel && selected && canEditLabel && <Html center position={[0, height / 2 + 0.01, 0]} zIndexRange={[18, 0]}>
        <NodeLabelEditor
          text={node.label}
          onCommit={(label) => {
            if (label !== node.label) editing?.onEditNodeLabel(node.id, label);
            setEditingLabel(false);
          }}
          onCancel={() => setEditingLabel(false)}
        />
      </Html>}
      {showHandles && ports.map((port) => (
        <Html key={port.id} center position={port.position} zIndexRange={[16, 0]}>
          <button
            type="button"
            aria-label={`Connect ${node.label || node.id} ${port.id}`}
            data-scene-control="true"
            title={`${port.id} connection handle`}
            className="block size-3 rounded-full border-2 border-white bg-[#a6192e] shadow ring-1 ring-[#a6192e] hover:scale-125"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onSelect(node.id, false, port.id); }}
          />
        </Html>
      ))}
    </group>
  );
}

/** Only the active edit uses DOM. Idle labels are part of the WebGL scene,
 * so they never cover other shapes with screen-space cards. */
function NodeLabelEditor({ text, onCommit, onCancel }: {
  text: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(text);
  const input = useRef<HTMLTextAreaElement>(null);
  const finished = useRef(false);
  useEffect(() => {
    const blurOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && input.current && !input.current.contains(event.target)) {
        input.current.blur();
      }
    };
    window.addEventListener('pointerdown', blurOutside, true);
    return () => window.removeEventListener('pointerdown', blurOutside, true);
  }, []);
  function finish(save: boolean) {
    if (finished.current) return;
    finished.current = true;
    if (save) onCommit(draft);
    else onCancel();
  }
  return <textarea
    ref={input}
    autoFocus
    rows={3}
    aria-label="Edit object label"
    data-scene-control="true"
    title="Enter to save; Shift+Enter for a new line; Escape to cancel"
    value={draft}
    onFocus={(event) => event.currentTarget.select()}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={() => finish(true)}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
    onDoubleClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); finish(true); }
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
    }}
    className="w-52 resize-y rounded border border-[#a6192e] bg-white px-2 py-1 text-sm text-[#423c35] shadow-sm outline-none"
  />;
}

/** World-root proxy keeps library snapping/gizmos independent of the scene
 * group's orientation. Convert edits back to local coordinates, and derive
 * geometry independently so live updates never compound the gizmo's scale. */
export function NodeTransformControl({ node, editing, orientation = 'floor' }: { node: DiagramSceneNode; editing: DiagramSceneEditing; orientation?: SceneOrientation }) {
  const proxy = useMemo(() => new THREE.Object3D(), []);
  const moving = useRef(false);
  const baseline = useRef<Vec3>([...node.size]);
  const mode = editing.tool === 'rotate' ? 'rotate' : editing.tool === 'scale' ? 'scale' : 'translate';
  useLayoutEffect(() => {
    if (moving.current) return;
    proxy.position.fromArray(diagramToWorld(node.position, orientation));
    proxy.rotation.set(...diagramRotationToWorld(node.rotation, orientation));
    proxy.scale.set(1, 1, 1);
    proxy.updateMatrixWorld(true);
  }, [node, orientation, proxy]);
  function patch(): NodeTransform3D {
    if (mode === 'rotate') return { rotation: worldRotationToDiagram([proxy.rotation.x, proxy.rotation.y, proxy.rotation.z], orientation) };
    if (mode === 'scale') {
      const artwork = node.type === 'VectorPathNode' || node.type === 'SourceImageNode';
      return { size: baseline.current.map((value, index) => Math.max(artwork && index !== 1 ? 0.01 : 0.02,
        value * Math.abs(proxy.scale.getComponent(index)))) as Vec3 };
    }
    return { position: worldToDiagram(proxy.position.toArray(), orientation) };
  }
  return (
    <>
      <primitive object={proxy} />
      <SceneTransformControls
        object={proxy}
        mode={mode}
        space={mode === 'scale' ? 'local' : 'world'}
        size={0.85}
        translationSnap={editing.snapToGrid ? 0.1 : null}
        rotationSnap={editing.snapToGrid ? Math.PI / 12 : null}
        scaleSnap={editing.snapToGrid ? 0.1 : null}
        onMouseDown={() => {
          moving.current = true;
          baseline.current = [...node.size];
          editing.onTransformNode(node.id, patch(), 'start');
        }}
        onObjectChange={() => { if (moving.current) editing.onTransformNode(node.id, patch(), 'update'); }}
        onMouseUp={() => {
          if (!moving.current) return;
          moving.current = false;
          editing.onTransformNode(node.id, patch(), 'end');
          proxy.scale.set(1, 1, 1);
        }}
      />
    </>
  );
}
