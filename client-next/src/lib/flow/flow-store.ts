import { create } from 'zustand';
import { nanoid } from 'nanoid';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';
import { createAnchorNode } from './nodes/anchor/anchor';
import type { Point } from './edges/types';

// Phase 3/4 demo graph — one node per geometry KIND plus entity + network, and
// a `connection` edge between two shapes so the custom edge renders. Replaced
// by real persistence in Phase 7.
const initialNodes: Node[] = [
  { id: 'rect', type: 'RectangleNode', position: { x: 40, y: 40 }, width: 150, height: 70, data: { label: 'Rectangle' } },
  { id: 'round', type: 'RoundedRectangleNode', position: { x: 230, y: 40 }, width: 150, height: 70, data: { label: 'Rounded' } },
  { id: 'ellipse', type: 'EllipseNode', position: { x: 420, y: 40 }, width: 150, height: 90, data: { label: 'Ellipse' } },
  { id: 'diamond', type: 'DiamondNode', position: { x: 40, y: 170 }, width: 120, height: 120, data: { label: 'Diamond' } },
  { id: 'para', type: 'ParallelogramNode', position: { x: 210, y: 180 }, width: 170, height: 90, data: { label: 'Parallelogram' } },
  { id: 'cube', type: 'CubeNode', position: { x: 430, y: 175 }, width: 120, height: 110, data: { label: 'Cube' } },
  { id: 'donut', type: 'DonutNode', position: { x: 40, y: 330 }, width: 120, height: 120, data: { label: 'Donut' } },
  { id: 'actor', type: 'ActorNode', position: { x: 220, y: 320 }, width: 90, height: 150, data: { label: 'Actor' } },
  { id: 'text', type: 'TextNode', position: { x: 370, y: 345 }, width: 140, height: 40, data: { label: 'Text node' } },
  {
    id: 'entity',
    type: 'EntityNode',
    position: { x: 620, y: 60 },
    width: 200,
    height: 120,
    data: { label: 'User', fields: [{ name: 'id', key: 'PK' }, { name: 'email' }, { name: 'name' }] },
  },
  {
    id: 'router',
    type: 'NetworkRouterNode',
    position: { x: 650, y: 250 },
    width: 96,
    height: 96,
    data: { label: 'Router', accentColor: '#a6192e' },
  },
];

const initialEdges: Edge[] = [
  {
    id: 'demo-conn',
    type: 'connection',
    source: 'rect',
    sourceHandle: 'right',
    target: 'ellipse',
    targetHandle: 'left',
    data: { bendPoints: [] },
  },
];

export type FlowState = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  // ── Editor actions the connection edge needs (ported from Flow.svelte's
  //    setContext functions — only the store owns the nodes/edges arrays). ──
  /** Create a floating-endpoint anchor node; returns its id. */
  addAnchorNode: (position: Point) => string;
  /** Make an edge the sole selection so toolbar styling targets it. */
  selectEdgeForStyling: (edgeId: string) => void;
  /** Rigid-move a fully-floating connection (both anchors + bends) in one tick. */
  moveFloatingConnection: (update: {
    edgeId: string;
    sourceId: string;
    sourcePosition: Point;
    targetId: string;
    targetPosition: Point;
    bendPoints: Point[];
  }) => void;
};

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  // New connections become `connection` edges with an empty bend list — the
  // same construct ConnectionEdge renders (ported from Flow.svelte onConnect).
  onConnect: (connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: nanoid(),
      type: 'connection',
      data: { bendPoints: [] },
    };
    set({ edges: addEdge(newEdge, get().edges) });
  },
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addAnchorNode: (position) => {
    const id = nanoid();
    set({ nodes: [...get().nodes, createAnchorNode(id, position)] });
    return id;
  },

  selectEdgeForStyling: (edgeId) => {
    set({
      nodes: get().nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      edges: get().edges.map((e) => ({ ...e, selected: e.id === edgeId })),
    });
  },

  moveFloatingConnection: (update) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === update.sourceId) return { ...node, position: update.sourcePosition };
        if (node.id === update.targetId) return { ...node, position: update.targetPosition };
        return node;
      }),
      edges: get().edges.map((edge) =>
        edge.id === update.edgeId
          ? { ...edge, data: { ...edge.data, bendPoints: update.bendPoints } }
          : edge,
      ),
    });
  },
}));
