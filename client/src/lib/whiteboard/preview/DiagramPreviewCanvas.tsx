'use client';

import { useEffect, useMemo, type CSSProperties } from 'react';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionMode,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  useStore,
  useViewport,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type FitViewOptions,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { SOURCE_IMAGE_NODE_TYPE, VECTOR_PATH_NODE_TYPE, type PagedDiagramData } from '@easydraw/diagram-schema';
import ShapeNode from '@/lib/flow/nodes/ShapeNode';
import VectorArtwork from '@/lib/flow/nodes/vector/VectorArtwork';
import SourceImageArtwork from '@/lib/flow/nodes/source-image/SourceImageArtwork';
import { toFiniteRotation } from '@/lib/flow/nodes/style-utils';
import { previewEdgeAppearance, previewEdgePath } from './preview-edge';
import '@xyflow/react/dist/style.css';
import '@/app/xy-theme.css';

interface Props {
  document: PagedDiagramData;
}

const SUPPORTED_NODE_TYPES = new Set([
  'RectangleNode',
  'RoundedRectangleNode',
  'EllipseNode',
  'DiamondNode',
  'DatabaseNode',
  'TextNode',
  VECTOR_PATH_NODE_TYPE,
  SOURCE_IMAGE_NODE_TYPE,
]);
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 3;
const FIT_OPTIONS: FitViewOptions = {
  // Keep the fitted artwork above the overlay controls, not merely inside the
  // canvas rectangle (otherwise a chart's origin can hide under the buttons).
  padding: { top: 0.2, right: 0.2, bottom: '64px', left: 0.2 },
  minZoom: MIN_ZOOM, maxZoom: 1.25,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** ShapeNode reads only its local React Flow instance. The inert subtree also
 * keeps its textareas and double-click editor out of this read-only preview. */
function PreviewShapeNode(props: NodeProps) {
  return (
    <div
      className="h-full w-full"
      onDoubleClickCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div inert className="pointer-events-none h-full w-full [&>div]:min-h-0 [&_*]:pointer-events-none [&_.react-flow__handle]:invisible">
        <ShapeNode {...props} selected={false} dragging={false} isConnectable={false} />
      </div>
    </div>
  );
}

/** Pure artwork is reused without mounting either editor wrapper/store. Hidden
 * handles supply edge endpoints only; the preview never permits connections. */
function PreviewArtworkNode({ data, width, height, type }: NodeProps) {
  return <div className="pointer-events-none relative h-full w-full"
    style={{ transform: `rotate(${toFiniteRotation(data.rotation)}deg)`, transformOrigin: 'center' }}>
    {type === VECTOR_PATH_NODE_TYPE ? <VectorArtwork data={data} width={width} height={height} />
      : type === SOURCE_IMAGE_NODE_TYPE ? <SourceImageArtwork data={data} />
        : <div role="img" aria-label="Unsupported preview object" className="flex h-full w-full items-center justify-center border border-dashed border-[#b39c85] text-xs text-[#807367]">Object unavailable</div>}
    {([['top', Position.Top], ['right', Position.Right], ['bottom', Position.Bottom], ['left', Position.Left]] as const)
      .map(([id, position]) => <Handle key={id} id={id} type="source" position={position}
        isConnectable={false} className="pointer-events-none invisible" />)}
  </div>;
}

const NODE_TYPES: NodeTypes = {
  ...Object.fromEntries([...SUPPORTED_NODE_TYPES].map((type) => [type, PreviewShapeNode])),
  [VECTOR_PATH_NODE_TYPE]: PreviewArtworkNode,
  [SOURCE_IMAGE_NODE_TYPE]: PreviewArtworkNode,
  UnsupportedPreviewNode: PreviewArtworkNode,
};

/** A standalone edge renderer: no editor actions, editable labels, or stores. */
function PreviewConnection({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  markerStart, markerEnd, data,
}: EdgeProps) {
  const [path, labelX, labelY] = previewEdgePath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  }, data?.routing);
  const appearance = previewEdgeAppearance(data);
  const labels = Array.isArray(data?.labels)
    ? data.labels.flatMap((label) => isRecord(label) && typeof label.text === 'string' && label.text
      ? [label.text] : [])
    : [];

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        interactionWidth={0}
        style={appearance}
      />
      <g pointerEvents="none" aria-hidden="true">
        {labels.map((text, index) => (
          <text
            key={index}
            x={labelX}
            y={labelY + (index - (labels.length - 1) / 2) * 16}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#423c35"
            stroke="#faf8f3"
            strokeWidth={5}
            strokeLinejoin="round"
            paintOrder="stroke"
            fontSize={12}
            fontFamily="inherit"
          >
            {text}
          </text>
        ))}
      </g>
    </>
  );
}

const EDGE_TYPES: EdgeTypes = { preview: PreviewConnection };

function createPreviewGraph(document: PagedDiagramData): { nodes: Node[]; edges: Edge[] } {
  // Clone before handing data to a rendering library. Neither measurements nor
  // any local viewport operation can alter the preview awaiting confirmation.
  const page = structuredClone(document.pages.find((item) => item.id === document.activePageId) ?? document.pages[0]);
  if (!page) return { nodes: [], edges: [] };
  const nodes: Node[] = page.nodes.map((node) => {
    const type = node.type && SUPPORTED_NODE_TYPES.has(node.type) ? node.type : 'UnsupportedPreviewNode';
    const width = Math.max(1, finite(node.width, 160));
    const height = Math.max(1, finite(node.height, type === 'TextNode' ? 40 : 80));
    const data = isRecord(node.data) ? node.data : {};
    const style = isRecord(node.style) ? node.style as CSSProperties : {};
    return {
      id: node.id,
      type,
      position: { x: finite(node.position?.x, 0), y: finite(node.position?.y, 0) },
      data,
      width,
      height,
      style: { ...style, width, height, cursor: 'grab' },
      selected: false,
      draggable: false,
      selectable: false,
      connectable: false,
      deletable: false,
      focusable: false,
      ariaLabel: typeof data.label === 'string' ? data.label : 'Preview object',
    };
  });
  const ids = new Set(nodes.map((node) => node.id));
  const edges: Edge[] = page.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => {
    const data = isRecord(edge.data) ? edge.data : {};
    const color = previewEdgeAppearance(data).stroke;
    const marker = { type: MarkerType.ArrowClosed, color, width: 18, height: 18, orient: 'auto-start-reverse' };
    return {
      id: edge.id,
      type: 'preview',
      source: edge.source,
      target: edge.target,
      sourceHandle: typeof edge.sourceHandle === 'string' ? edge.sourceHandle : 'right',
      targetHandle: typeof edge.targetHandle === 'string' ? edge.targetHandle : 'left',
      data,
      markerStart: data.markerStart === 'triangle' ? { ...marker } : undefined,
      markerEnd: data.markerEnd === 'triangle' ? { ...marker } : undefined,
      selected: false,
      selectable: false,
      deletable: false,
      reconnectable: false,
      focusable: false,
    };
  });
  return { nodes, edges };
}

function PreviewViewport({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const initialized = useNodesInitialized();
  const { zoom } = useViewport();
  // Stale notices, source details and narrow tabs can resize this viewer after
  // its initial fit. React Flow already observes the actual viewport; refit on
  // those dimensions only, never on ordinary user pan/zoom interactions.
  const viewportWidth = useStore((state) => state.width);
  const viewportHeight = useStore((state) => state.height);
  useEffect(() => {
    if (!initialized || !nodes.length || !viewportWidth || !viewportHeight) return;
    const frame = requestAnimationFrame(() => { void fitView(FIT_OPTIONS); });
    return () => cancelAnimationFrame(frame);
  }, [initialized, nodes, edges, fitView, viewportWidth, viewportHeight]);

  const buttonClass = 'flex size-8 items-center justify-center rounded-md text-[#6d6257] hover:bg-[#f6f0e6] hover:text-[#76232f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a6192e] disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <>
      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          edgesReconnectable={false}
          elementsSelectable={false}
          selectionOnDrag={false}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          panActivationKeyCode={null}
          zoomActivationKeyCode={null}
          disableKeyboardA11y
          zoomOnDoubleClick={false}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          fitView
          fitViewOptions={FIT_OPTIONS}
          aria-label="Read-only diagram preview"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#ded7cb" />
        </ReactFlow>
      </div>
      {!nodes.length && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-5 text-center text-sm text-[#807367]">
          No objects in this preview.
        </p>
      )}
      <div
        role="group"
        aria-label="Preview view controls"
        className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-lg border border-[#e4dace] bg-white/95 p-1 shadow-sm"
        onKeyDown={(event) => event.stopPropagation()}
      >
        <button type="button" aria-label="Zoom out preview" title="Zoom out preview" className={buttonClass}
          disabled={!nodes.length || zoom <= MIN_ZOOM} onClick={() => { void zoomOut({ duration: 120 }); }}>
          <Minus size={16} />
        </button>
        <span className="min-w-11 text-center text-xs tabular-nums text-[#6d6257]" aria-label="Preview zoom level">
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" aria-label="Zoom in preview" title="Zoom in preview" className={buttonClass}
          disabled={!nodes.length || zoom >= MAX_ZOOM} onClick={() => { void zoomIn({ duration: 120 }); }}>
          <Plus size={16} />
        </button>
        <span className="mx-1 h-5 w-px bg-[#e4dace]" aria-hidden="true" />
        <button type="button" aria-label="Fit preview" title="Fit preview" className={buttonClass}
          disabled={!nodes.length} onClick={() => { void fitView({ ...FIT_OPTIONS, duration: 120 }); }}>
          <Maximize2 size={15} />
        </button>
      </div>
    </>
  );
}

/** A disposable viewer, not an editor: it owns only a local pan/zoom viewport. */
export default function DiagramPreviewCanvas({ document }: Props) {
  const graph = useMemo(() => createPreviewGraph(document), [document]);
  return (
    <section
      aria-label="Diagram preview"
      data-testid="diagram-preview-canvas"
      data-whiteboard-preview="true"
      className="relative h-full min-h-[260px] w-full overflow-hidden rounded-xl border border-[#e4dace] bg-[#faf8f3]"
      onDoubleClickCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <ReactFlowProvider>
        <PreviewViewport nodes={graph.nodes} edges={graph.edges} />
      </ReactFlowProvider>
    </section>
  );
}
