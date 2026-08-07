'use client';

import { useEffect, useRef } from 'react';
import { useEditor } from '@/lib/flow/EditorContext';
import { useFlowStore } from '@/lib/flow/flow-store';
import { createEditorKeyboardHandler } from '@/lib/flow/keyboard-shortcuts';
import { selectAllGraph, groupSelectedNodes, ungroupSelectedNodes } from '@/lib/flow/graph-actions';
import { ANCHOR_NODE_TYPE } from '@/lib/flow/nodes/anchor/anchor';

// Registers the global editor keyboard shortcuts (Ctrl+Z/Y/C/X/D/A/G, Delete,
// B/I/U, zoom, fit…) once, reading the latest editor context through a ref so
// the listener never needs re-binding. Renders nothing.
export default function KeyboardShortcuts() {
  const editor = useEditor();
  const editorRef = useRef(editor);
  editorRef.current = editor;

  useEffect(() => {
    const anySelected = () => {
      const s = useFlowStore.getState();
      return (
        s.nodes.some((n) => n.selected && n.type !== ANCHOR_NODE_TYPE) ||
        s.edges.some((e) => e.selected)
      );
    };

    const handler = createEditorKeyboardHandler({
      save: () => editorRef.current.save(),
      saveAs: () => editorRef.current.save(),
      undo: () => editorRef.current.undo(),
      redo: () => editorRef.current.redo(),
      duplicate: () => editorRef.current.duplicate(),
      copy: () => editorRef.current.copy(),
      cut: () => editorRef.current.cut(),
      paste: () => editorRef.current.paste(),
      deleteSelected: () => editorRef.current.deleteSelected(),
      bringToFront: () => editorRef.current.bringToFront(),
      sendToBack: () => editorRef.current.sendToBack(),
      fitView: () => editorRef.current.fitView(),
      zoomIn: () => editorRef.current.zoomIn(),
      zoomOut: () => editorRef.current.zoomOut(),
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
      toggleTextStyle: (field) => {
        const st = editorRef.current.nodeStyle;
        if (!st) return;
        editorRef.current.applyStyle({ [field]: !st[field] });
      },
      hasSelection: anySelected,
      hasStyleSelection: anySelected,
    });

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return null;
}
