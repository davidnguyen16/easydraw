'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { DiagramSceneEdge, Vec3 } from './scene-model';
import type { DiagramSceneEditing } from './types';
import { SceneEditableLabel, sceneLabelStyle } from './SceneEditableLabel';
import { SceneMarker } from './SceneMarker';
import { SceneTransformControls } from './SceneTransformControls';
import { diagramToWorld, worldToDiagram, type SceneOrientation } from './scene-orientation';

export function pointAlong(points: Vec3[], fraction: number): Vec3 {
  const lengths = points.slice(1).map((point, index) => new THREE.Vector3(...point).distanceTo(new THREE.Vector3(...points[index])));
  let remaining = lengths.reduce((total, length) => total + length, 0) * Math.min(1, Math.max(0, fraction));
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const t = lengths[index] > 0 ? remaining / lengths[index] : 0;
      return new THREE.Vector3(...points[index]).lerp(new THREE.Vector3(...points[index + 1]), t).toArray() as Vec3;
    }
    remaining -= lengths[index];
  }
  return points[0] ?? [0, 0, 0];
}

export interface SelectedBend { edgeId: string; index: number }
export interface SelectedEndpoint { edgeId: string; end: 'source' | 'target' }

/** Parallel rails retain a double-line connection's appearance in space. */
function rail(points: Vec3[], offset: number): Vec3[] {
  return points.map((point, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const direction = new THREE.Vector3(...after).sub(new THREE.Vector3(...before));
    const side = direction.clone().cross(new THREE.Vector3(0, 1, 0));
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
    return new THREE.Vector3(...point).addScaledVector(side.normalize(), offset).toArray() as Vec3;
  });
}

export function SceneConnection3D({ edge, selected, editing, bend, onSelectBend, onSelectEndpoint, onReconnect, orientation = 'floor' }: {
  edge: DiagramSceneEdge;
  selected: boolean;
  editing?: DiagramSceneEditing;
  bend: SelectedBend | null;
  onSelectBend: (bend: SelectedBend) => void;
  onSelectEndpoint: (endpoint: SelectedEndpoint) => void;
  onReconnect: (edgeId: string, end: 'source' | 'target') => void;
  orientation?: SceneOrientation;
}) {
  if (edge.points.length < 2) return null;
  const last = edge.points.length - 1;
  const canEdit = Boolean(editing && !editing.disabled && editing.tool !== 'orbit');
  function context(event: { stopPropagation(): void; clientX: number; clientY: number }) {
    event.stopPropagation();
    editing?.onContextMenu?.('edge', edge.id, event.clientX, event.clientY);
  }
  return (
    <group
      onClick={(event) => { event.stopPropagation(); if (canEdit) editing?.onSelectEdge(edge.id, event.shiftKey || event.ctrlKey || event.metaKey); }}
      onContextMenu={(event) => { event.nativeEvent.preventDefault(); context(event); }}
    >
      {(edge.lineStyle === 'double' ? [rail(edge.points, -0.025), rail(edge.points, 0.025)] : [edge.points]).map((points, railIndex) => <Line
        key={railIndex}
        points={points}
        color={selected ? '#a6192e' : edge.color}
        lineWidth={edge.width + (selected ? 1.5 : 0)}
        dashed={edge.dashed}
        dashSize={edge.lineStyle === 'dotted' ? 0.015 : 0.18}
        gapSize={edge.lineStyle === 'dotted' ? 0.08 : 0.12}
        onClick={(event) => { event.stopPropagation(); if (canEdit) editing?.onSelectEdge(edge.id, event.shiftKey || event.ctrlKey || event.metaKey); }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (!canEdit || !editing) return;
          const point = worldToDiagram(event.point.toArray(), orientation);
          editing.onMoveEdgePoint(edge.id, -1, point, 'start');
          editing.onMoveEdgePoint(edge.id, -1, point, 'end');
        }}
        onContextMenu={(event) => { event.nativeEvent.preventDefault(); context(event); }}
      />)}
      {edge.markerStart !== 'none' && <SceneMarker kind={edge.markerStart} point={edge.points[0]} adjacent={edge.points[1]} color={edge.color} />}
      {edge.markerEnd !== 'none' && <SceneMarker kind={edge.markerEnd} point={edge.points[last]} adjacent={edge.points[last - 1]} color={edge.color} />}
      {edge.labels.map((label, index) => (
        <Html key={label.id ?? index} center position={pointAlong(edge.points, label.t)} zIndexRange={[8, 0]}>
          <SceneEditableLabel
            text={label.text}
            id={edge.id}
            kind="edge"
            selected={selected}
            editing={canEdit}
            style={sceneLabelStyle(edge.data, 11)}
            onSelect={(additive) => editing?.onSelectEdge(edge.id, additive)}
            onCommit={(text) => editing?.onEditEdgeLabel(edge.id, label.id, text)}
            onContextMenu={(event) => { event.preventDefault(); context(event); }}
          />
        </Html>
      ))}
      {selected && canEdit && !edge.labels.length && <Html center position={pointAlong(edge.points, 0.5)} zIndexRange={[9, 0]}>
        <SceneEditableLabel text="" id={edge.id} kind="edge" selected editing onSelect={() => {}} onCommit={(text) => editing?.onEditEdgeLabel(edge.id, undefined, text)} />
      </Html>}
      {selected && canEdit && edge.bendPoints.map((point, index) => (
        <group key={index} position={point}>
          <mesh onClick={(event) => { event.stopPropagation(); onSelectBend({ edgeId: edge.id, index }); }}>
            <sphereGeometry args={[0.07, 12, 8]} />
            <meshBasicMaterial color={bend?.edgeId === edge.id && bend.index === index ? '#2563eb' : '#a6192e'} depthTest={false} />
          </mesh>
          <Html center position={[0, 0.14, 0]} zIndexRange={[15, 0]}>
            <button type="button" aria-label={`Move connection ${edge.id} point ${index + 1}`} data-scene-control="true"
              className="size-4 rounded-full border border-white bg-[#a6192e] text-[9px] text-white shadow"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onSelectBend({ edgeId: edge.id, index }); }}
            >{index + 1}</button>
          </Html>
        </group>
      ))}
      {selected && canEdit && (editing?.onReconnect || editing?.onMoveEdgeEndpoint) && (['source', 'target'] as const).map((end) => (
        <Html key={end} center position={edge.points[end === 'source' ? 0 : last]} zIndexRange={[14, 0]}>
          <div className="flex items-center gap-1.5" data-scene-control="true">
          {editing?.onMoveEdgeEndpoint && <button
            type="button"
            aria-label={`Move ${end} of connection ${edge.id}`}
            title={`Move ${end} in space using the X/Y/Z handles (detach from object)`}
            className="block size-3 rounded-sm border-2 border-white bg-emerald-600 shadow ring-1 ring-emerald-600 hover:scale-125"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onSelectEndpoint({ edgeId: edge.id, end }); }}
          />}
          {editing?.onReconnect && <button
            type="button"
            aria-label={`Reconnect ${end} of connection ${edge.id}`}
            data-scene-control="true"
            title={`Reconnect ${end}: click a new object or handle`}
            className="block size-3 rounded-full border-2 border-white bg-blue-600 shadow ring-1 ring-blue-600 hover:scale-125"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onReconnect(edge.id, end); }}
          />}
          </div>
        </Html>
      ))}
    </group>
  );
}

export function EdgeEndpointControl({ edge, end, editing, orientation = 'floor' }: { edge: DiagramSceneEdge; end: 'source' | 'target'; editing: DiagramSceneEditing; orientation?: SceneOrientation }) {
  const point = edge.points[end === 'source' ? 0 : edge.points.length - 1];
  const proxy = useMemo(() => new THREE.Object3D(), []);
  const moving = useRef(false);
  useLayoutEffect(() => {
    if (!moving.current && point) { proxy.position.fromArray(diagramToWorld(point, orientation)); proxy.updateMatrixWorld(true); }
  }, [orientation, point, proxy]);
  if (!point || !editing.onMoveEdgeEndpoint) return null;
  return <>
    <primitive object={proxy} />
    <SceneTransformControls object={proxy} mode="translate" space="world" size={0.7}
      translationSnap={editing.snapToGrid ? 0.1 : null}
      onMouseDown={() => { moving.current = true; editing.onMoveEdgeEndpoint?.(edge.id, end, point, 'start'); }}
      onObjectChange={() => { if (moving.current) editing.onMoveEdgeEndpoint?.(edge.id, end, worldToDiagram(proxy.position.toArray(), orientation), 'update'); }}
      onMouseUp={() => {
        if (!moving.current) return;
        moving.current = false;
        editing.onMoveEdgeEndpoint?.(edge.id, end, worldToDiagram(proxy.position.toArray(), orientation), 'end');
      }}
    />
  </>;
}

export function EdgePointControl({ edge, index, editing, orientation = 'floor' }: { edge: DiagramSceneEdge; index: number; editing: DiagramSceneEditing; orientation?: SceneOrientation }) {
  const point = edge.bendPoints[index];
  const proxy = useMemo(() => new THREE.Object3D(), []);
  const moving = useRef(false);
  useLayoutEffect(() => {
    if (!moving.current && point) { proxy.position.fromArray(diagramToWorld(point, orientation)); proxy.updateMatrixWorld(true); }
  }, [orientation, point, proxy]);
  if (!point) return null;
  return (
    <>
      <primitive object={proxy} />
      <SceneTransformControls
        object={proxy}
        mode="translate"
        space="world"
        size={0.65}
        translationSnap={editing.snapToGrid ? 0.1 : null}
        onMouseDown={() => { moving.current = true; editing.onMoveEdgePoint(edge.id, index, point, 'start'); }}
        onObjectChange={() => { if (moving.current) editing.onMoveEdgePoint(edge.id, index, worldToDiagram(proxy.position.toArray(), orientation), 'update'); }}
        onMouseUp={() => {
          if (!moving.current) return;
          moving.current = false;
          editing.onMoveEdgePoint(edge.id, index, worldToDiagram(proxy.position.toArray(), orientation), 'end');
        }}
      />
    </>
  );
}
