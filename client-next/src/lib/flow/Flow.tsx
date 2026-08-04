'use client';

import { useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  ConnectionMode,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
} from '@xyflow/react';
import { nanoid } from 'nanoid';
import '@xyflow/react/dist/style.css';
import '@/app/xy-theme.css';
import { useFlowStore } from './flow-store';
import ShapeNode from './nodes/ShapeNode';
import EntityNode from './nodes/entity-relation/entity/component';
import NetworkNode from './nodes/network/NetworkNode';
import AnchorNode from './nodes/anchor/AnchorNode';
import { ANCHOR_NODE_TYPE, ANCHOR_HANDLE_ID } from './nodes/anchor/anchor';
import { NETWORK_DEFINITIONS } from './nodes/network/definitions';
import { VARIANTS } from './nodes/shape-geometry';
import ConnectionEdge from './edges/ConnectionEdge';
import ConnectionLinePreview from './edges/ConnectionLinePreview';
import StylePanel from '@/lib/components/style-panel/StylePanel';
import ConnectionStylePanel from '@/lib/components/ConnectionStylePanel';
import type { NodeStyleData } from '@/lib/components/style-panel/types';
import { useFontPreviewStore } from './font-preview-store';
import {
  bringSelectedToFront,
  sendSelectedToBack,
  duplicateSelectedNodes,
  deleteSelectedGraph,
} from './graph-actions';
import { useEditorStore } from '@/lib/stores/editor.store';
import { EditorProvider } from './EditorContext';
import ToolBar from '@/lib/components/ToolBar';
import ContextMenu from './ContextMenu';
import Sidebar from '@/lib/components/sidebar/Sidebar';
import { getShape } from './nodes/registry';
import { dndState } from './dnd';

// Every registered shape type renders through ShapeNode (it switches on the
// geometry KIND, never on the node type); entity + network nodes have their
// own components, and the connection anchor is an internal type for floating
// edge endpoints. Built once so the reference stays stable across renders.
const nodeTypes: NodeTypes = {
  ...Object.fromEntries(Object.keys(VARIANTS).map((id) => [id, ShapeNode])),
  EntityNode,
  WeakEntityNode: EntityNode,
  ...Object.fromEntries(NETWORK_DEFINITIONS.map((def) => [def.id, NetworkNode])),
  [ANCHOR_NODE_TYPE]: AnchorNode,
};

const edgeTypes: EdgeTypes = {
  connection: ConnectionEdge,
};

const defaultEdgeOptions = {
  type: 'connection',
};

function Canvas() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const setPreview = useFontPreviewStore((s) => s.setPreview);
  const locked = useEditorStore((s) => s.locked);
  const showStylePanel = useEditorStore((s) => s.showStylePanel);

  // Right-click context menu (position kept relative to the canvas wrapper).
  const [menu, setMenu] = useState<{ id: string; top?: number; left?: number; right?: number; bottom?: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();

  // A selected NODE drives the style panel (anchors are internal, never a
  // styling target). Edges get their own panel in a later phase.
  const selectedNode = nodes.find((n) => n.selected && n.type !== ANCHOR_NODE_TYPE);
  const selectedEdge = edges.find((e) => e.selected);

  // Style edits land on node.data (or edge.data). Read the latest graph from the
  // store inside each handler to avoid stale closures (ported from Flow.svelte).
  const handleStyleChange = (patch: Partial<NodeStyleData>) => {
    const s = useFlowStore.getState();
    const node = s.nodes.find((n) => n.selected && n.type !== ANCHOR_NODE_TYPE);
    if (node) {
      s.setNodes(s.nodes.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, ...patch } } : n)));
      return;
    }
    const edge = s.edges.find((e) => e.selected);
    if (edge) {
      s.setEdges(s.edges.map((e) => (e.id === edge.id ? { ...e, data: { ...e.data, ...patch } } : e)));
    }
  };

  // Hover-preview: park the value on the selected target without touching data.
  const handleFontPreview = (family: string) => {
    const target = selectedNode ?? selectedEdge;
    if (target) setPreview({ targetId: target.id, fontFamily: family });
  };
  const handleFontPreviewEnd = () => setPreview(null);

  const handlePositionChange = (x: number, y: number) => {
    const s = useFlowStore.getState();
    const node = s.nodes.find((n) => n.selected && n.type !== ANCHOR_NODE_TYPE);
    if (node) s.setNodes(s.nodes.map((n) => (n.id === node.id ? { ...n, position: { x, y } } : n)));
  };

  const handleSizeChange = (width: number, height: number) => {
    const s = useFlowStore.getState();
    const node = s.nodes.find((n) => n.selected && n.type !== ANCHOR_NODE_TYPE);
    if (node) s.setNodes(s.nodes.map((n) => (n.id === node.id ? { ...n, width, height } : n)));
  };

  const handleBringToFront = () => {
    const s = useFlowStore.getState();
    s.setNodes(bringSelectedToFront(s.nodes));
  };
  const handleSendToBack = () => {
    const s = useFlowStore.getState();
    s.setNodes(sendSelectedToBack(s.nodes));
  };
  const handleDuplicate = () => {
    const s = useFlowStore.getState();
    const createOnEdit = (nodeId: string) => (patch: Record<string, unknown>) => {
      const st = useFlowStore.getState();
      st.setNodes(st.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)));
    };
    s.setNodes(duplicateSelectedNodes(s.nodes, createOnEdit));
  };
  const handleDelete = () => {
    const s = useFlowStore.getState();
    const next = deleteSelectedGraph(s.nodes, s.edges);
    if (next.changed) {
      s.setNodes(next.nodes);
      s.setEdges(next.edges);
    }
  };

  // Edge styling writes into edge.data (marker / line style / routing / width /
  // colour), mirroring the node handler.
  const handleEdgeDataChange = (patch: Record<string, unknown>) => {
    const s = useFlowStore.getState();
    const e = s.edges.find((ed) => ed.selected);
    if (e) s.setEdges(s.edges.map((ed) => (ed.id === e.id ? { ...ed, data: { ...ed.data, ...patch } } : ed)));
  };

  // Right-clicking a node selects it (unless already in a multi-selection), then
  // opens the menu positioned within the canvas, flipped near the edges.
  const handleNodeContextMenu = (event: React.MouseEvent, node: { id: string }) => {
    event.preventDefault();
    const s = useFlowStore.getState();
    const target = s.nodes.find((n) => n.id === node.id);
    if (target && !target.selected) {
      s.setNodes(s.nodes.map((n) => ({ ...n, selected: n.id === node.id })));
      s.setEdges(s.edges.map((e) => ({ ...e, selected: false })));
    }
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setMenu({
      id: node.id,
      top: y < rect.height - 200 ? y : undefined,
      left: x < rect.width - 200 ? x : undefined,
      right: x >= rect.width - 200 ? rect.width - x : undefined,
      bottom: y >= rect.height - 200 ? rect.height - y : undefined,
    });
  };
  const closeMenu = () => setMenu(null);

  // Palette drag → drop: read the shape id parked by NodeContainer, look it up
  // in the registry, and create a node (or a floating connection for edge
  // presets) at the drop position.
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const shapeId = dndState.current;
    dndState.current = null;
    if (!shapeId) return;
    const shape = getShape(shapeId);
    if (!shape) return;
    const position = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });

    if (shape.edgePreset) {
      const preset = shape.edgePreset(position);
      const srcId = useFlowStore.getState().addAnchorNode(preset.source);
      const tgtId = useFlowStore.getState().addAnchorNode(preset.target);
      const st = useFlowStore.getState();
      const newEdge: Edge = {
        id: nanoid(),
        type: 'connection',
        source: srcId,
        sourceHandle: ANCHOR_HANDLE_ID,
        target: tgtId,
        targetHandle: ANCHOR_HANDLE_ID,
        data: preset.data,
        selected: true,
      };
      st.setNodes(st.nodes.map((n) => ({ ...n, selected: false })));
      st.setEdges([...st.edges.map((e) => ({ ...e, selected: false })), newEdge]);
      return;
    }

    const newNode: Node = {
      id: nanoid(),
      type: shape.id,
      position,
      data: shape.defaultData(),
      selected: true,
      ...(shape.defaultWidth ? { width: shape.defaultWidth } : {}),
      ...(shape.defaultHeight ? { height: shape.defaultHeight } : {}),
      ...(shape.defaultZIndex !== undefined ? { zIndex: shape.defaultZIndex } : {}),
    };
    const st = useFlowStore.getState();
    st.setNodes([...st.nodes.map((n) => ({ ...n, selected: false })), newNode]);
    st.setEdges(st.edges.map((e) => ({ ...e, selected: false })));
  };

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        connectionLineComponent={ConnectionLinePreview}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        elementsSelectable={!locked}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={closeMenu}
        onNodeClick={closeMenu}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} />
        <Controls />
      </ReactFlow>

      {showStylePanel && selectedNode ? (
        <StylePanel
          node={selectedNode}
          onStyleChange={handleStyleChange}
          onFontPreview={handleFontPreview}
          onFontPreviewEnd={handleFontPreviewEnd}
          onPositionChange={handlePositionChange}
          onSizeChange={handleSizeChange}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      ) : showStylePanel && selectedEdge ? (
        <ConnectionStylePanel
          edge={selectedEdge}
          onDataChange={handleEdgeDataChange}
          onDelete={handleDelete}
        />
      ) : null}

      {menu && (
        <ContextMenu
          id={menu.id}
          top={menu.top}
          left={menu.left}
          right={menu.right}
          bottom={menu.bottom}
          onClick={closeMenu}
        />
      )}

      <Sidebar />
    </div>
  );
}

// Full editor shell: ReactFlowProvider → EditorProvider (context for the
// chrome) → ToolBar on top + the canvas filling the rest.
export default function Flow() {
  return (
    <ReactFlowProvider>
      <EditorProvider>
        <div className="flex h-full w-full flex-col">
          <ToolBar />
          <div className="relative min-h-0 flex-1">
            <Canvas />
          </div>
        </div>
      </EditorProvider>
    </ReactFlowProvider>
  );
}
