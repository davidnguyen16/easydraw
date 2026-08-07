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

// The canvas starts empty; DiagramPersistence hydrates it from the active page
// (loaded via GET /diagrams/:id) on mount. A new diagram has no nodes.
const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

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
