'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useDiagramId } from './use-diagram-id';
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
  type Edge,
  type OnConnectEnd,
} from '@xyflow/react';
import { nanoid } from 'nanoid';
import '@xyflow/react/dist/style.css';
import '@/app/xy-theme.css';
import { useFlowStore } from './flow-store';
import ShapeNode from './nodes/ShapeNode';
import CustomImageNode from './nodes/custom/CustomImageNode';
import VectorPathNode from './nodes/vector/VectorPathNode';
import SourceImageNode from './nodes/source-image/SourceImageNode';
import { SOURCE_IMAGE_NODE_TYPE, VECTOR_PATH_NODE_TYPE } from '@easydraw/diagram-schema';
import EntityNode from './nodes/entity-relation/entity/component';
import AnchorNode from './nodes/anchor/AnchorNode';
import { ANCHOR_NODE_TYPE, ANCHOR_HANDLE_ID, createAnchorNode } from './nodes/anchor/anchor';
import { VARIANTS } from './nodes/shape-geometry';
import ConnectionEdge from './edges/ConnectionEdge';
import ConnectionLinePreview from './edges/ConnectionLinePreview';
import StylePanel from '@/lib/components/style-panel/StylePanel';
import ConnectionStylePanel from '@/lib/components/ConnectionStylePanel';
import type { NodeStyleData } from '@/lib/components/style-panel/types';
import { useFontPreviewStore } from './font-preview-store';
import { useEditorStore } from '@/lib/stores/editor.store';
import { EditorProvider, useEditor } from './EditorContext';
import MenuBar from '@/lib/components/MenuBar';
import ToolBar from '@/lib/components/ToolBar';
import KeyboardShortcuts from './KeyboardShortcuts';
import ContextMenu from './ContextMenu';
import Sidebar from '@/lib/components/sidebar/Sidebar';
import CanvasScrollbars from './CanvasScrollbars';
import { useSidebarStore } from '@/lib/stores/sidebar.store';
import { FLOATING_STYLE_PANEL_INSET_PX } from '@/lib/components/style-panel/layout';
import { getShape } from './nodes/registry';
import type { NodeDataChangeOptions } from './nodes/types';
import { MIN_ZOOM, MAX_ZOOM } from './zoom';
import { dndState } from './dnd';
import { createPaletteNode } from './palette-node';
import { clearAssetCache } from '@/lib/node-library/assets';
import DiagramPersistence from './DiagramPersistence';
import EditorFooter from '@/lib/components/EditorFooter';
import PresentBar from '@/lib/components/PresentBar';
import ImportNotice from '@/lib/components/ImportNotice';
import Diagram3DToolbar from '@/lib/diagram3d/Diagram3DToolbar';
import type { DiagramViewMode } from '@/lib/diagram3d/types';

// Neither Three.js nor a WebGL context is loaded until the user opens 3D.
const Diagram3DView = dynamic(() => import('@/lib/diagram3d/Diagram3DView'), {
  ssr: false,
  loading: () => <div role="status" className="flex h-full items-center justify-center bg-[#f6f5f1] text-sm text-[#77786f]">Loading 3D view…</div>,
});

// Every registered shape type renders through ShapeNode (it switches on the
// geometry KIND, never on the node type); entity nodes have their
// own components, and the connection anchor is an internal type for floating
// edge endpoints. Built once so the reference stays stable across renders.
const nodeTypes: NodeTypes = {
  ...Object.fromEntries(Object.keys(VARIANTS).map((id) => [id, ShapeNode])),
  EntityNode,
  WeakEntityNode: EntityNode,
  CustomImageNode,
  [VECTOR_PATH_NODE_TYPE]: VectorPathNode,
  [SOURCE_IMAGE_NODE_TYPE]: SourceImageNode,
  [ANCHOR_NODE_TYPE]: AnchorNode,
};

const edgeTypes: EdgeTypes = {
  connection: ConnectionEdge,
};

const defaultEdgeOptions = {
  type: 'connection',
};

function Canvas({ active = true }: { active?: boolean }) {
  const editor = useEditor();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const setPreview = useFontPreviewStore((s) => s.setPreview);
  const locked = useEditorStore((s) => s.locked);
  const showStylePanel = useEditorStore((s) => s.showStylePanel);
  const showGrid = useEditorStore((s) => s.showGrid);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const presenting = useEditorStore((s) => s.presenting);
  const sidebarWidth = useSidebarStore((s) => (s.isCollapsed ? 0 : s.renderedWidth));

  // Right-click context menu (position kept relative to the canvas wrapper).
  const [menu, setMenu] = useState<{ id: string; top?: number; left?: number; right?: number; bottom?: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();

  // A selected NODE drives the style panel (anchors are internal, never a
  // styling target). Edges get their own panel in a later phase.
  const selectedNode = nodes.find((n) => n.selected && n.type !== ANCHOR_NODE_TYPE);
  const selectedEdge = edges.find((e) => e.selected);
  const rightInset = showStylePanel && (selectedNode || selectedEdge) ? FLOATING_STYLE_PANEL_INSET_PX : 0;

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

  const handleNodeDataChange = (
    nodeId: string,
    patch: Record<string, unknown>,
    options?: NodeDataChangeOptions,
  ) => {
    const state = useFlowStore.getState();

    state.setNodes(
      state.nodes.map((node) => {
        if (node.id !== nodeId) return node;

        const updatedNode = {
          ...node,
          data: {
            ...node.data,
            ...patch,
          },
        };

        if (!options?.resetHeight) return updatedNode;

        return {
          ...updatedNode,
          height: undefined,
          style: node.style
            ? {
                ...node.style,
                height: undefined,
              }
            : undefined,
        };
      }),
    );
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
    editor.bringToFront();
  };
  const handleSendToBack = () => {
    editor.sendToBack();
  };
  const handleDuplicate = () => {
    editor.duplicate();
  };
  const handleDelete = () => {
    editor.deleteSelected();
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
    const payload = dndState.current;
    dndState.current = null;
    if (!payload || !active || locked || presenting) return;
    const shape = typeof payload === 'string' ? getShape(payload) : undefined;
    const position = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });

    if (shape?.edgePreset) {
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

    const newNode = createPaletteNode(payload, position, nanoid());
    if (!newNode) return;
    const st = useFlowStore.getState();
    st.setNodes([...st.nodes.map((n) => ({ ...n, selected: false })), newNode]);
    st.setEdges(st.edges.map((e) => ({ ...e, selected: false })));
  };

  // When a freshly dragged connection is released over EMPTY canvas (no valid
  // handle under the pointer), xyflow fires no onConnect — so drop a floating
  // anchor at the release point and keep the edge, that end attached to the
  // anchor. Guarded by `toHandle` so it never double-creates alongside onConnect.
  const handleConnectEnd: OnConnectEnd = (event, connectionState) => {
    if (connectionState.toHandle) return;
    const fromHandle = connectionState.fromHandle;
    if (!fromHandle) return;

    const pt = 'changedTouches' in event ? event.changedTouches[0] : event;
    const position = rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
    const anchorId = nanoid();
    const anchor = createAnchorNode(anchorId, position);

    // fromHandle is the end the user started dragging; the floating anchor takes
    // the opposite role.
    const base = { id: nanoid(), type: 'connection', data: { bendPoints: [] } };
    const newEdge: Edge =
      fromHandle.type === 'target'
        ? { ...base, source: anchorId, sourceHandle: ANCHOR_HANDLE_ID, target: fromHandle.nodeId, targetHandle: fromHandle.id ?? null }
        : { ...base, source: fromHandle.nodeId, sourceHandle: fromHandle.id ?? null, target: anchorId, targetHandle: ANCHOR_HANDLE_ID };

    // Anchor + edge in the same tick so the anchor is always referenced.
    const s = useFlowStore.getState();
    s.setNodes([...s.nodes, anchor]);
    s.setEdges([...s.edges, newEdge]);
  };

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={handleConnectEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        connectionLineComponent={ConnectionLinePreview}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        panOnScroll
        zoomOnScroll={false}
        nodesDraggable={active && !locked && !presenting}
        nodesConnectable={active && !locked && !presenting}
        elementsSelectable={active && !locked && !presenting}
        nodesFocusable={active}
        edgesFocusable={active}
        deleteKeyCode={active ? 'Backspace' : null}
        selectionKeyCode={active ? 'Shift' : null}
        multiSelectionKeyCode={active ? ['Meta', 'Control'] : null}
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneClick={closeMenu}
        onNodeClick={closeMenu}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
      >
        {showGrid && <Background variant={BackgroundVariant.Dots} />}
        <Controls />
      </ReactFlow>

      {/* Present mode hides all editor chrome — just the read-only canvas. */}
      {active && !presenting && (
        <>
          <CanvasScrollbars
            nodes={nodes}
            edges={edges}
            leftInset={sidebarWidth}
            rightInset={rightInset}
            onNavigationStart={closeMenu}
          />

          {showStylePanel && selectedNode ? (
            <StylePanel
              node={selectedNode}
              onStyleChange={handleStyleChange}
              onNodeDataChange={handleNodeDataChange}
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
        </>
      )}
    </div>
  );
}

// MenuBar + ToolBar + footer are hidden in present mode (read-only fullscreen
// canvas). DiagramPersistence runs the sync/autosave effects; PresentBar is the
// floating present-mode control.
function FlowShell({ diagramId }: { diagramId: string }) {
  useEffect(() => () => clearAssetCache(), []);
  const viewMode = useEditorStore((state) => state.viewMode);
  const is3D = viewMode === '3d';
  const changeViewMode = useCallback((mode: DiagramViewMode) => {
    if (mode === '3d') {
      useFontPreviewStore.getState().setPreview(null);
    }
    useEditorStore.getState().setViewMode(mode);
  }, []);
  const returnTo2D = useCallback(() => changeViewMode('2d'), [changeViewMode]);
  const presenting = useEditorStore((s) => s.presenting);
  return (
    <>
      <div className="flex h-full w-full flex-col">
        {!presenting && (
          <div>
            <MenuBar />
          </div>
        )}
        {!presenting && (
          <div>
            <ToolBar onViewModeChange={changeViewMode} />
          </div>
        )}
        {is3D && !presenting && <Diagram3DToolbar />}
        <div className="relative min-h-0 flex-1">
          {/* Keep the original viewport mounted and sized. Inert + disabled
              ReactFlow keys stop hidden 2D actions without resetting pan/zoom. */}
          <div className={`absolute inset-0 ${is3D ? 'invisible pointer-events-none' : ''}`} inert={is3D} aria-hidden={is3D}>
            <Canvas active={!is3D} />
          </div>
          {is3D && <div className="absolute inset-0"><Diagram3DView onReturnTo2D={returnTo2D} /></div>}
          {!presenting && <ImportNotice />}
        </div>
        {!presenting && (
          <div>
            <EditorFooter />
          </div>
        )}
      </div>
      {!presenting && <KeyboardShortcuts />}
      {presenting && <PresentBar onViewModeChange={changeViewMode} />}
      <DiagramPersistence diagramId={diagramId} />
    </>
  );
}

// Full editor shell: ReactFlowProvider → EditorProvider (context for the chrome).
export default function Flow() {
  const diagramId = useDiagramId();
  return (
    <ReactFlowProvider>
      <EditorProvider>
        <FlowShell key={diagramId} diagramId={diagramId} />
      </EditorProvider>
    </ReactFlowProvider>
  );
}
