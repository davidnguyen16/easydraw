'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useFlowStore } from '@/lib/flow/flow-store';
import { useEditorStore } from '@/lib/stores/editor.store';
import { useFontPreviewStore } from '@/lib/flow/font-preview-store';
import { ANCHOR_NODE_TYPE } from '@/lib/flow/nodes/anchor/anchor';
import {
  duplicateSelectedNodes,
  deleteSelectedGraph,
  copySelection,
  bringSelectedToFront,
  sendSelectedToBack,
  bringSelectedForward,
  sendSelectedBackward,
  toggleNodeLock,
  type ClipboardSnapshot,
} from '@/lib/flow/graph-actions';
import type { NodeStyleData } from '@/lib/components/style-panel/types';

export interface NodeTextStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textColor: string;
}

// The chrome (ToolBar, MenuBar) reads this — the React counterpart of
// Flow.svelte's setContext('editor', …). Actions that need history/persistence
// (save/undo/redo/open/newFile) are stubbed until those pieces are ported.
export interface EditorContextValue {
  state: { zoomPercent: number; locked: boolean; showStylePanel: boolean };
  history: { canUndo: boolean; canRedo: boolean };
  save: () => void;
  open: () => void;
  newFile: () => void;
  undo: () => void;
  redo: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  fitSelection: () => void;
  setZoom: (percent: number) => void;
  toggleLock: () => void;
  toggleStylePanel: () => void;
  copy: () => void;
  cut: () => void;
  duplicate: () => void;
  deleteSelected: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  toggleNodeLock: (id: string) => void;
  nodeStyle: NodeTextStyle | null;
  applyStyle: (patch: NodeStyleData) => void;
  previewStyle: (patch: { fontFamily?: string; fontSize?: number }) => void;
  endPreview: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within <EditorProvider>');
  return ctx;
}

// Module-level clipboard (paste is wired in a later phase).
let clipboard: ClipboardSnapshot | null = null;

export function EditorProvider({ children }: { children: ReactNode }) {
  const rf = useReactFlow();
  const { zoom } = useViewport();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const locked = useEditorStore((s) => s.locked);
  const showStylePanel = useEditorStore((s) => s.showStylePanel);
  const toggleLock = useEditorStore((s) => s.toggleLock);
  const toggleStylePanel = useEditorStore((s) => s.toggleStylePanel);
  const setPreview = useFontPreviewStore((s) => s.setPreview);

  // Text style of the current selection (node wins, else edge, else null so the
  // toolbar shows its own defaults).
  const selNode = nodes.find((n) => n.selected && n.type !== ANCHOR_NODE_TYPE);
  const selEdge = edges.find((e) => e.selected);
  const target = selNode ?? selEdge;
  const td = (target?.data ?? {}) as Record<string, unknown>;
  const nodeStyle: NodeTextStyle | null = target
    ? {
        fontFamily: (td.fontFamily as string) ?? 'Inter',
        fontSize: (td.fontSize as number) ?? (selNode ? 14 : 13),
        bold: !!td.bold,
        italic: !!td.italic,
        underline: !!td.underline,
        textColor: (td.textColor as string) ?? '#2c2c2a',
      }
    : null;

  const applyStyle = (patch: NodeStyleData) => {
    const s = useFlowStore.getState();
    const n = s.nodes.find((x) => x.selected && x.type !== ANCHOR_NODE_TYPE);
    if (n) {
      s.setNodes(s.nodes.map((x) => (x.id === n.id ? { ...x, data: { ...x.data, ...patch } } : x)));
      return;
    }
    const e = s.edges.find((x) => x.selected);
    if (e) s.setEdges(s.edges.map((x) => (x.id === e.id ? { ...x, data: { ...x.data, ...patch } } : x)));
  };

  const previewStyle = (patch: { fontFamily?: string; fontSize?: number }) => {
    const s = useFlowStore.getState();
    const t =
      s.nodes.find((x) => x.selected && x.type !== ANCHOR_NODE_TYPE) ?? s.edges.find((x) => x.selected);
    if (t) setPreview({ targetId: t.id, ...patch });
  };

  const value: EditorContextValue = {
    state: { zoomPercent: Math.round(zoom * 100), locked, showStylePanel },
    history: { canUndo: false, canRedo: false }, // TODO: undo/redo history
    save: () => {}, // TODO: persistence
    open: () => {}, // TODO: file open
    newFile: () => {}, // TODO
    undo: () => {}, // TODO
    redo: () => {}, // TODO
    zoomIn: () => rf.zoomIn(),
    zoomOut: () => rf.zoomOut(),
    fitView: () => rf.fitView({ maxZoom: 1 }),
    fitSelection: () => rf.fitView({ nodes: nodes.filter((n) => n.selected), maxZoom: 1 }),
    setZoom: (percent) => rf.zoomTo(percent / 100),
    toggleLock,
    toggleStylePanel,
    copy: () => {
      const s = useFlowStore.getState();
      clipboard = copySelection(s.nodes, s.edges) ?? clipboard;
    },
    cut: () => {
      const s = useFlowStore.getState();
      clipboard = copySelection(s.nodes, s.edges) ?? clipboard;
      const next = deleteSelectedGraph(s.nodes, s.edges);
      if (next.changed) {
        s.setNodes(next.nodes);
        s.setEdges(next.edges);
      }
    },
    bringToFront: () => {
      const s = useFlowStore.getState();
      s.setNodes(bringSelectedToFront(s.nodes));
    },
    sendToBack: () => {
      const s = useFlowStore.getState();
      s.setNodes(sendSelectedToBack(s.nodes));
    },
    bringForward: () => {
      const s = useFlowStore.getState();
      s.setNodes(bringSelectedForward(s.nodes));
    },
    sendBackward: () => {
      const s = useFlowStore.getState();
      s.setNodes(sendSelectedBackward(s.nodes));
    },
    toggleNodeLock: (id: string) => {
      const s = useFlowStore.getState();
      s.setNodes(toggleNodeLock(s.nodes, id));
    },
    duplicate: () => {
      const s = useFlowStore.getState();
      const createOnEdit = (id: string) => (p: Record<string, unknown>) => {
        const st = useFlowStore.getState();
        st.setNodes(st.nodes.map((x) => (x.id === id ? { ...x, data: { ...x.data, ...p } } : x)));
      };
      s.setNodes(duplicateSelectedNodes(s.nodes, createOnEdit));
    },
    deleteSelected: () => {
      const s = useFlowStore.getState();
      const next = deleteSelectedGraph(s.nodes, s.edges);
      if (next.changed) {
        s.setNodes(next.nodes);
        s.setEdges(next.edges);
      }
    },
    nodeStyle,
    applyStyle,
    previewStyle,
    endPreview: () => setPreview(null),
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}
