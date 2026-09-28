'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { nanoid } from 'nanoid';
import { useFlowStore } from '@/lib/flow/flow-store';
import { useEditorDoc } from '@/lib/stores/editor-doc.store';
import { useEditorStore } from '@/lib/stores/editor.store';
import { useSidebarStore } from '@/lib/stores/sidebar.store';
import { useEditor } from '@/lib/flow/EditorContext';
import { beginGraphGesture, endGraphGesture, runGraphCommand } from '@/lib/flow/editor-commands';
import { getShape } from '@/lib/flow/nodes/registry';
import { createPaletteNode } from '@/lib/flow/palette-node';
import { createAnchorNode, ANCHOR_HANDLE_ID, ANCHOR_NODE_TYPE } from '@/lib/flow/nodes/anchor/anchor';
import type { NodeDataChangeOptions } from '@/lib/flow/nodes/types';
import StylePanel from '@/lib/components/style-panel/StylePanel';
import ConnectionStylePanel from '@/lib/components/ConnectionStylePanel';
import { FLOATING_STYLE_PANEL_INSET_PX } from '@/lib/components/style-panel/layout';
import Sidebar from '@/lib/components/sidebar/Sidebar';
import ContextMenu from '@/lib/flow/ContextMenu';
import { buildDiagramScene, type DiagramSceneModel, type Vec3 } from './scene-model';
import { diagramPositionFromWorld, transformDiagramNodes } from './editing-actions';
import { SpatialControls, ConnectionControls3D } from './SpatialControls';
import Object3DPanel from './Object3DPanel';
import { combineSceneNodes } from './combine-objects';
import { canCarryRecipe } from './visual3d';
import DiagramScene from './DiagramScene';
import type { DiagramCamera, DiagramSceneEditing } from './types';
import { editableEdgeLabels } from './edge-editing';

/** One shared graph; only the camera and optional spatial attributes are 3D-specific. */
export default function Diagram3DView({ onReturnTo2D }: { onReturnTo2D: () => void }) {
  const pageId = useEditorDoc((s) => s.activePageId);
  return <EditablePage key={pageId} pageId={pageId} onReturnTo2D={onReturnTo2D} />;
}

function EditablePage({ pageId, onReturnTo2D }: { pageId: string; onReturnTo2D(): void }) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const page = useEditorDoc((s) => s.pages.find((item) => item.id === pageId));
  const tool = useEditorStore((s) => s.tool3d);
  const locked = useEditorStore((s) => s.locked);
  const presenting = useEditorStore((s) => s.presenting);
  const showStylePanel = useEditorStore((s) => s.showStylePanel);
  const showGrid = useEditorStore((s) => s.showGrid);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const sidebarWidth = useSidebarStore((s) => s.isCollapsed ? 0 : s.renderedWidth);
  const editor = useEditor();
  // Freeze the adapter origin while editing so moving a node never recenters all objects.
  const [origin] = useState<Vec3>(() => page?.view3d?.origin ?? buildDiagramScene(useFlowStore.getState().nodes, useFlowStore.getState().edges).origin);
  const model = useMemo(() => buildDiagramScene(nodes, edges, { origin }), [nodes, edges, origin]);
  const gesture = useRef<{ nodes: Node[]; model: DiagramSceneModel } | null>(null);
  const bendGesture = useRef<{ edgeId: string; index: number } | null>(null);
  const endpointGesture = useRef<{ point: Vec3; anchorId?: string } | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ id: string; kind: 'node' | 'edge'; top: number; left: number } | null>(null);
  const disabled = locked || presenting;
  const selectedNode = nodes.find((node) => node.selected && node.type !== ANCHOR_NODE_TYPE);
  const selectedEdge = edges.find((edge) => edge.selected);
  const canEdit = () => !useEditorStore.getState().locked && !useEditorStore.getState().presenting && useEditorDoc.getState().activePageId === pageId;
  const command = (action: () => void) => { if (canEdit()) runGraphCommand(action); };

  useEffect(() => () => {
    if (gesture.current || bendGesture.current || endpointGesture.current) endGraphGesture();
  }, []);

  useEffect(() => {
    // Older camera snapshots used an implicit centered origin. Pin that origin
    // before the graph changes so reload and view switching cannot shift it.
    if (page?.view3d?.camera && !page.view3d.origin) useEditorDoc.getState().setPageCamera3D(pageId, page.view3d.camera, origin);
  }, [origin, page?.view3d, pageId]);

  const onCameraChange = useCallback((camera: DiagramCamera) => {
    if (useEditorDoc.getState().activePageId === pageId) useEditorDoc.getState().setPageCamera3D(pageId, camera, origin);
  }, [pageId, origin]);

  const select = (kind: 'node' | 'edge', id: string, additive: boolean) => {
    if (!canEdit()) return;
    setMenu(null);
    const state = useFlowStore.getState();
    if (kind === 'node') {
      const already = state.nodes.some((node) => node.id === id && node.selected);
      state.setNodes(state.nodes.map((node) => ({ ...node, selected: node.id === id ? (additive ? !node.selected : true) : additive || already ? node.selected : false })));
      if (!additive && !already) state.setEdges(state.edges.map((edge) => ({ ...edge, selected: false })));
    } else {
      const already = state.edges.some((edge) => edge.id === id && edge.selected);
      state.setEdges(state.edges.map((edge) => ({ ...edge, selected: edge.id === id ? (additive ? !edge.selected : true) : additive || already ? edge.selected : false })));
      if (!additive && !already) state.setNodes(state.nodes.map((node) => ({ ...node, selected: false })));
    }
  };
  const changeNode = (id: string, patch: Record<string, unknown>, options?: NodeDataChangeOptions) => command(() => {
    const state = useFlowStore.getState();
    state.setNodes(state.nodes.map((node) => node.id !== id || node.data.locked ? node : {
      ...node, data: { ...node.data, ...patch },
      ...(options?.resetHeight ? { height: undefined, measured: { ...node.measured, height: undefined }, style: { ...node.style, height: undefined } } : {}),
    }));
  });
  // Slider drags in the Object tab write straight to the graph; the gesture around them records the undo step.
  const liveChangeNode = (id: string, patch: Record<string, unknown>) => {
    if (!canEdit()) return;
    const state = useFlowStore.getState();
    state.setNodes(state.nodes.map((node) => node.id !== id || node.data.locked ? node : { ...node, data: { ...node.data, ...patch } }));
  };
  const combineSelected = () => command(() => {
    const state = useFlowStore.getState();
    const selectedIds = new Set(state.nodes.filter((node) => node.selected && node.type !== ANCHOR_NODE_TYPE && !node.data.locked).map((node) => node.id));
    const result = combineSceneNodes(model.nodes.filter((node) => selectedIds.has(node.id)), state.edges, nanoid());
    if (!result) return;
    const removed = new Set(result.removedIds);
    state.setNodes([...state.nodes.filter((node) => !removed.has(node.id)).map((node) => ({ ...node, selected: false })), result.node]);
    state.setEdges(result.edges);
  });
  const changeEdge = (id: string, patch: Record<string, unknown>) => command(() => {
    const state = useFlowStore.getState();
    state.setEdges(state.edges.map((edge) => edge.id === id ? {
      ...edge, ...(Array.isArray(patch.labels) ? { label: undefined } : {}),
      data: { ...edge.data, ...patch, ...(Array.isArray(patch.labels) ? { label: undefined } : {}) },
    } : edge));
  });
  const reconnect = (edgeId: string, end: 'source' | 'target', nodeId: string, handleId?: string) => command(() => {
    const state = useFlowStore.getState();
    if (!state.nodes.some((node) => node.id === nodeId)) return;
    state.setEdges(state.edges.map((edge) => edge.id === edgeId ? { ...edge, [end]: nodeId, [`${end}Handle`]: handleId ?? null } : edge));
  });

  const editing: DiagramSceneEditing = {
    tool, disabled, snapToGrid, showGrid,
    selectedNodeIds: nodes.filter((node) => node.selected).map((node) => node.id),
    selectedEdgeIds: edges.filter((edge) => edge.selected).map((edge) => edge.id),
    onSelectNode: (id, additive) => select('node', id, additive),
    onSelectEdge: (id, additive) => select('edge', id, additive),
    onClearSelection: () => {
      setMenu(null);
      if (!canEdit()) return;
      const state = useFlowStore.getState();
      state.setNodes(state.nodes.map((node) => ({ ...node, selected: false })));
      state.setEdges(state.edges.map((edge) => ({ ...edge, selected: false })));
    },
    onTransformNode: (id, patch, phase) => {
      if (!canEdit()) { if (phase === 'end') { gesture.current = null; endGraphGesture(); } return; }
      if (phase === 'start' || !gesture.current) {
        beginGraphGesture();
        const state = useFlowStore.getState();
        gesture.current = { nodes: state.nodes, model: buildDiagramScene(state.nodes, state.edges, { origin }) };
      }
      const baseline = gesture.current;
      useFlowStore.getState().setNodes(transformDiagramNodes(baseline.nodes, baseline.model, id, patch, snapToGrid));
      if (phase === 'end') { gesture.current = null; endGraphGesture(); }
    },
    onConnect: (source, target, sourceHandle, targetHandle) => command(() => {
      const state = useFlowStore.getState();
      if (![source, target].every((id) => state.nodes.some((node) => node.id === id && !node.data.locked))) return;
      const edge: Edge = { id: nanoid(), type: 'connection', source, target, sourceHandle: sourceHandle ?? null, targetHandle: targetHandle ?? null, selected: true, data: { bendPoints: [] } };
      state.setNodes(state.nodes.map((node) => ({ ...node, selected: false })));
      state.setEdges([...state.edges.map((item) => ({ ...item, selected: false })), edge]);
    }),
    onDropShape: (shapeId, point) => command(() => {
      const shape = typeof shapeId === 'string' ? getShape(shapeId) : undefined;
      if (typeof shapeId === 'string' && !shape) return;
      const position = diagramPositionFromWorld(point, origin);
      if (snapToGrid) { position.x = Math.round(position.x / 20) * 20; position.y = Math.round(position.y / 20) * 20; }
      const state = useFlowStore.getState();
      const existingNodes = state.nodes.map((node) => ({ ...node, selected: false }));
      const existingEdges = state.edges.map((edge) => ({ ...edge, selected: false }));
      if (shape?.edgePreset) {
        const preset = shape.edgePreset(position);
        const source = createAnchorNode(nanoid(), preset.source), target = createAnchorNode(nanoid(), preset.target);
        state.setNodes([...existingNodes, source, target]);
        state.setEdges([...existingEdges, { id: nanoid(), type: 'connection', source: source.id, target: target.id, sourceHandle: ANCHOR_HANDLE_ID, targetHandle: ANCHOR_HANDLE_ID, data: preset.data, selected: true }]);
      } else {
        const node = createPaletteNode(shapeId, position, nanoid());
        if (!node) return;
        state.setNodes([...existingNodes, node]);
        state.setEdges(existingEdges);
      }
    }),
    onEditNodeLabel: (id, label) => changeNode(id, { label }),
    onEditEdgeLabel: (edgeId, labelId, text) => {
      const edge = useFlowStore.getState().edges.find((item) => item.id === edgeId);
      if (!edge) return;
      const labels = editableEdgeLabels(edge);
      changeEdge(edgeId, { labels: labelId && labels.some((label) => label.id === labelId)
        ? labels.flatMap((label) => label.id === labelId ? (text ? [{ ...label, text }] : []) : [label])
        : text ? [...labels, { id: nanoid(), text, t: 0.5 }] : labels });
    },
    onMoveEdgePoint: (edgeId, index, point, phase) => {
      if (!canEdit()) { if (phase === 'end') { bendGesture.current = null; endGraphGesture(); } return; }
      const state = useFlowStore.getState();
      const edge = state.edges.find((item) => item.id === edgeId);
      if (!edge) return;
      const bends = Array.isArray(edge.data?.bendPoints) ? [...edge.data.bendPoints] : [];
      if (phase === 'start' || !bendGesture.current) {
        beginGraphGesture();
        bendGesture.current = { edgeId, index: index < 0 ? bends.length : index };
      }
      bends[bendGesture.current.index] = { ...diagramPositionFromWorld(point, origin), z: point[1] + origin[1] };
      state.setEdges(state.edges.map((item) => item.id === edgeId ? { ...item, data: { ...item.data, bendPoints: bends, routing: 'orthogonal' } } : item));
      if (phase === 'end') { bendGesture.current = null; endGraphGesture(); }
    },
    onMoveEdgeEndpoint: (edgeId, end, point, phase) => {
      if (!canEdit() || point.length !== 3 || !point.every(Number.isFinite)) { if (phase === 'end') { endpointGesture.current = null; endGraphGesture(); } return; }
      if (phase === 'start' || !endpointGesture.current) {
        beginGraphGesture(); endpointGesture.current = { point: [...point] };
        if (phase === 'start') return;
      }
      const pending = endpointGesture.current;
      const changed = pending.anchorId || point.some((value, index) => Math.abs(value - pending.point[index]) > 1e-6);
      const state = useFlowStore.getState();
      const edge = state.edges.find((item) => item.id === edgeId);
      if (changed && edge) {
        const current = state.nodes.find((node) => node.id === edge[end]);
        const shared = state.edges.some((item) => item.id !== edgeId && (item.source === current?.id || item.target === current?.id));
        const reusable = current?.type === ANCHOR_NODE_TYPE && !shared && edge.source !== edge.target;
        const anchorId = pending.anchorId ?? (reusable ? current.id : nanoid());
        pending.anchorId = anchorId;
        const position = diagramPositionFromWorld(point, origin);
        const anchor = { ...createAnchorNode(anchorId, position), data: { spatial3d: { depth: 0.02, elevation: point[1] + origin[1] - 0.01 } } };
        state.setNodes(state.nodes.some((node) => node.id === anchorId) ? state.nodes.map((node) => node.id === anchorId ? anchor : node) : [...state.nodes, anchor]);
        state.setEdges(state.edges.map((item) => item.id === edgeId ? { ...item, [end]: anchorId, [`${end}Handle`]: ANCHOR_HANDLE_ID } : item));
      }
      if (phase === 'end') { endpointGesture.current = null; endGraphGesture(); }
    },
    onReconnect: reconnect,
    onContextMenu: (kind, id, x, y) => {
      if (!canEdit()) return;
      select(kind, id, false);
      const rect = wrapper.current?.getBoundingClientRect();
      if (rect) setMenu({ kind, id, left: Math.max(0, Math.min(x - rect.left, rect.width - 205)), top: Math.max(0, Math.min(y - rect.top, rect.height - 300)) });
    },
  };

  return <div ref={wrapper} className="relative h-full w-full">
    <div className="absolute inset-y-0 right-0" style={{ left: presenting ? 0 : sidebarWidth }}>
      <DiagramScene model={model} camera={page?.view3d?.camera} onCameraChange={onCameraChange} onReturnTo2D={onReturnTo2D} editing={editing}
        orientation={page?.view3d?.orientation ?? 'floor'} showGrid={page?.view3d?.showGrid ?? showGrid}
        onOrientationChange={(orientation) => useEditorDoc.getState().setPagePresentation3D(pageId, { orientation })}
        onShowGridChange={(visible) => useEditorDoc.getState().setPagePresentation3D(pageId, { showGrid: visible })}
        rightInset={!presenting && showStylePanel && (selectedNode || selectedEdge) ? FLOATING_STYLE_PANEL_INSET_PX : 0} />
    </div>
    {!presenting && <>
      <div inert={locked}><Sidebar /></div>
      {showStylePanel && selectedNode ? <StylePanel node={selectedNode}
        onStyleChange={(patch) => changeNode(selectedNode.id, patch)} onNodeDataChange={changeNode}
        onFontPreview={(fontFamily) => editor.previewStyle({ fontFamily })} onFontPreviewEnd={editor.endPreview}
        onPositionChange={(x, y) => command(() => { const state = useFlowStore.getState(); state.setNodes(state.nodes.map((node) => node.id === selectedNode.id && !node.data.locked && Number.isFinite(x) && Number.isFinite(y) ? { ...node, position: { x, y } } : node)); })}
        onSizeChange={(width, height) => command(() => { const state = useFlowStore.getState(); if (!Number.isFinite(width) || !Number.isFinite(height)) return; state.setNodes(state.nodes.map((node) => node.id === selectedNode.id && !node.data.locked ? { ...node, width, height, measured: { width, height }, style: { ...node.style, width, height } } : node)); })}
        onBringToFront={editor.bringToFront} onSendToBack={editor.sendToBack} onDuplicate={editor.duplicate} onDelete={editor.deleteSelected}
        spatialControls={<SpatialControls node={selectedNode} sceneNode={model.nodes.find((node) => node.id === selectedNode.id)} onChange={(patch) => changeNode(selectedNode.id, patch)} onToggleLock={() => editor.toggleNodeLock(selectedNode.id)} />}
        objectControls={canCarryRecipe(selectedNode.type ?? '') ? <Object3DPanel key={selectedNode.id} node={selectedNode} disabled={disabled}
          selectedCount={nodes.filter((node) => node.selected && node.type !== ANCHOR_NODE_TYPE).length}
          onChange={(patch) => changeNode(selectedNode.id, patch)} onLiveChange={(patch) => liveChangeNode(selectedNode.id, patch)} onCombine={combineSelected} /> : undefined} />
      : showStylePanel && selectedEdge ? <ConnectionStylePanel edge={selectedEdge} onDataChange={(patch) => changeEdge(selectedEdge.id, patch)} onDelete={editor.deleteSelected}
        extraControls={<ConnectionControls3D edge={selectedEdge} nodes={nodes} onChange={(patch) => changeEdge(selectedEdge.id, patch)} onReconnect={(end, nodeId) => reconnect(selectedEdge.id, end, nodeId)} />} /> : null}
      {menu?.kind === 'node' && <ContextMenu id={menu.id} left={menu.left} top={menu.top} onClick={() => setMenu(null)} />}
      {menu?.kind === 'edge' && <div role="menu" className="absolute z-50 rounded border border-line bg-white p-2 shadow" style={{ left: menu.left, top: menu.top }}>
        <button type="button" className="p-2 text-xs" onClick={() => { editor.deleteSelected(); setMenu(null); }}>Delete connection</button>
      </div>}
    </>}
  </div>;
}
