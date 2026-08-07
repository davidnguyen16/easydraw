'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useDiagramId } from '@/lib/flow/use-diagram-id';
import {
  undo as historyUndo,
  redo as historyRedo,
  useHistoryStore,
} from '@/lib/stores/history.store';
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
  selectAllGraph,
  groupSelectedNodes,
  ungroupSelectedNodes,
  pasteSnapshot,
  type ClipboardSnapshot,
} from '@/lib/flow/graph-actions';
import { EXPORTERS } from '@/lib/exporters';
import {
  handleSave as saveDiagram,
  handleSaveAs as saveAsDiagram,
  handleExport as exportDiagram,
  handleNewFile as newFileDiagram,
  loadFileContent,
  applyHistorySnapshot,
} from '@/lib/flow/editor-persistence';
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
// Flow.svelte's setContext('editor', …). Save/export/present/pages are wired
// through editor-persistence.ts (module-level, operating on the global stores).
export interface ExportFormat {
  id: string;
  label: string;
  extension: string;
}

export interface EditorContextValue {
  state: {
    zoomPercent: number;
    locked: boolean;
    showStylePanel: boolean;
    showGrid: boolean;
    snapToGrid: boolean;
    saveStatus: 'saved' | 'saving' | 'error';
  };
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
  // ── MenuBar surface (export / save / present / pages — all live via
  //    editor-persistence.ts). ──
  saveAs: () => void;
  exportFormats: readonly ExportFormat[];
  exportAs: (formatId: string) => void;
  paste: () => void;
  selectAll: () => void;
  group: () => void;
  ungroup: () => void;
  present: () => void;
  toggleShowGrid: () => void;
  toggleSnapToGrid: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within <EditorProvider>');
  return ctx;
}

// Module-level clipboard for copy/cut/paste + the cascade counter so successive
// pastes land offset from one another.
let clipboard: ClipboardSnapshot | null = null;
let pasteCount = 0;

export function EditorProvider({ children }: { children: ReactNode }) {
  const rf = useReactFlow();
  const diagramId = useDiagramId();
  const { zoom } = useViewport();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const locked = useEditorStore((s) => s.locked);
  const showStylePanel = useEditorStore((s) => s.showStylePanel);
  const toggleLock = useEditorStore((s) => s.toggleLock);
  const toggleStylePanel = useEditorStore((s) => s.toggleStylePanel);
  const showGrid = useEditorStore((s) => s.showGrid);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const toggleShowGrid = useEditorStore((s) => s.toggleShowGrid);
  const toggleSnapToGrid = useEditorStore((s) => s.toggleSnapToGrid);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const setPresenting = useEditorStore((s) => s.setPresenting);
  const setPreview = useFontPreviewStore((s) => s.setPreview);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);

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
    state: {
      zoomPercent: Math.round(zoom * 100),
      locked,
      showStylePanel,
      showGrid,
      snapToGrid,
      saveStatus,
    },
    history: { canUndo, canRedo },
    save: () => saveDiagram(diagramId),
    open: () => {
      // Load a .easydraw / JSON file from disk into the editor (File > Open).
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.easydraw,application/json,.json,application/xml,.xml';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result;
          if (typeof content !== 'string') return;
          if (!loadFileContent(content)) {
            window.alert('Failed to open: file is not a valid EasyDraw diagram.');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    },
    newFile: () => newFileDiagram(),
    undo: () => {
      const snap = historyUndo();
      if (snap) applyHistorySnapshot(snap);
    },
    redo: () => {
      const snap = historyRedo();
      if (snap) applyHistorySnapshot(snap);
    },
    zoomIn: () => rf.zoomIn(),
    zoomOut: () => rf.zoomOut(),
    fitView: () => rf.fitView({ maxZoom: 1 }),
    fitSelection: () => rf.fitView({ nodes: nodes.filter((n) => n.selected), maxZoom: 1 }),
    setZoom: (percent) => rf.zoomTo(percent / 100),
    toggleLock,
    toggleStylePanel,
    copy: () => {
      const s = useFlowStore.getState();
      const snap = copySelection(s.nodes, s.edges);
      if (!snap) return;
      clipboard = snap;
      pasteCount = 0;
    },
    cut: () => {
      const s = useFlowStore.getState();
      const hasSelection = s.nodes.some((n) => n.selected) || s.edges.some((e) => e.selected);
      if (!hasSelection) return;
      const snap = copySelection(s.nodes, s.edges);
      if (snap) {
        clipboard = snap;
        pasteCount = 0;
      }
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
    saveAs: () => saveAsDiagram(),
    exportFormats: EXPORTERS.map((e) => ({ id: e.id, label: e.label, extension: e.extension })),
    exportAs: (formatId) => exportDiagram(formatId),
    paste: () => {
      if (!clipboard) return;
      pasteCount += 1;
      const s = useFlowStore.getState();
      const createOnEdit = (nodeId: string) => (patch: Record<string, unknown>) => {
        const st = useFlowStore.getState();
        st.setNodes(
          st.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)),
        );
      };
      const next = pasteSnapshot(s.nodes, s.edges, clipboard, pasteCount, createOnEdit);
      s.setNodes(next.nodes);
      s.setEdges(next.edges);
    },
    present: () => {
      // Clear selection so no red ring / style panel lingers over the canvas;
      // PresentBar fits the view once the chrome is hidden.
      const s = useFlowStore.getState();
      s.setNodes(s.nodes.map((n) => ({ ...n, selected: false })));
      s.setEdges(s.edges.map((e) => ({ ...e, selected: false })));
      setPresenting(true);
    },
    toggleShowGrid,
    toggleSnapToGrid,
    selectAll: () => {
      const s = useFlowStore.getState();
      const next = selectAllGraph(s.nodes, s.edges);
      s.setNodes(next.nodes);
      s.setEdges(next.edges);
    },
    group: () => {
      const s = useFlowStore.getState();
      const result = groupSelectedNodes(s.nodes);
      if (result.grouped) s.setNodes(result.nodes);
    },
    ungroup: () => {
      const s = useFlowStore.getState();
      const result = ungroupSelectedNodes(s.nodes);
      if (result.ungrouped) s.setNodes(result.nodes);
    },
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}
