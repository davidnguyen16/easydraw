'use client';

import { useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { ConnectionLabel, Point } from './types';

const MIN_LABEL_GAP_PX = 14;

type LabelUpdater = (updater: (prev: ConnectionLabel[]) => ConnectionLabel[]) => void;

interface ConnectionLabelEditorOptions {
  getLabels: () => ConnectionLabel[];
  getTotalLength: () => number;
  tAtFlowPoint: (point: Point) => number;
  screenToFlowPosition: (point: Point) => Point;
  patchLabels: LabelUpdater;
  selectEdgeForStyling: () => void;
}

/**
 * Connection-label editing controller, ported from the Svelte runes factory
 * (connection-label-editor.svelte.ts) as a React hook. Same behaviour:
 * double-click the line → create a label at that point; double-click a label →
 * edit it; Enter commits, Escape cancels, blur commits; empty text deletes.
 */
export function useConnectionLabelEditor({
  getLabels,
  getTotalLength,
  tAtFlowPoint,
  screenToFlowPosition,
  patchLabels,
  selectEdgeForStyling,
}: ConnectionLabelEditorOptions) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingT, setEditingT] = useState(0.5);
  // Draft + flags live in refs: the contenteditable owns the visible text, so
  // keystrokes must not re-render (and re-position the caret).
  const draftRef = useRef('');
  const cancelledRef = useRef(false);
  const editingWasNewRef = useRef(false);
  const editorElRef = useRef<HTMLElement | null>(null);

  const isEditing = editingId !== null;

  function createAt(flowPoint: Point) {
    const t = tAtFlowPoint(flowPoint);
    const tooClose = getLabels().some(
      (label) => Math.abs(label.t - t) * getTotalLength() < MIN_LABEL_GAP_PX,
    );
    if (tooClose) return;

    editingWasNewRef.current = true;
    setEditingT(t);
    draftRef.current = '';
    setEditingId(nanoid());
    selectEdgeForStyling();
  }

  function startEditing(labelId: string) {
    const found = getLabels().find((label) => label.id === labelId);
    if (!found) return;

    editingWasNewRef.current = false;
    setEditingT(found.t);
    draftRef.current = found.text;
    setEditingId(labelId);
    selectEdgeForStyling();
  }

  function blurIfDeselected(selected: boolean | undefined) {
    if (editingId !== null && !selected) {
      editorElRef.current?.blur();
    }
  }

  /** Install while editing: any pointerdown outside the editor blurs it.
   *  Call from a useEffect keyed on `editingId`; returns the cleanup. */
  function installClickAway() {
    if (editingId === null) return;

    const onPointerDown = (event: PointerEvent) => {
      const el = editorElRef.current;
      if (event.target instanceof Node && el && !el.contains(event.target)) {
        el.blur();
      }
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }

  /** dblclick on the line body → create a label at the pointer. */
  function onCreateDblclick(event: React.MouseEvent) {
    event.stopPropagation();
    createAt(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }

  /** Callback ref for the contenteditable editor: seed the draft text, focus,
   *  and put the caret at the end (the Svelte `initEditor` action). */
  function editorRef(node: HTMLElement | null) {
    editorElRef.current = node;
    if (!node) return;
    node.textContent = draftRef.current;
    requestAnimationFrame(() => {
      node.focus();
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
  }

  function onEditorInput(event: React.FormEvent<HTMLElement>) {
    draftRef.current = (event.currentTarget as HTMLElement).textContent ?? '';
  }

  function onEditorKeydown(event: React.KeyboardEvent<HTMLElement>) {
    event.stopPropagation();
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      (event.currentTarget as HTMLElement).blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelledRef.current = true;
      (event.currentTarget as HTMLElement).blur();
    }
  }

  function commitLabel() {
    const text = draftRef.current.trim();
    const targetId = editingId;
    const wasNew = editingWasNewRef.current;
    const t = editingT;

    patchLabels((prev) => {
      if (!text) return prev.filter((label) => label.id !== targetId);
      if (wasNew) return [...prev, { id: targetId as string, t, text }];
      return prev.map((label) => (label.id === targetId ? { ...label, text } : label));
    });

    setEditingId(null);
  }

  function onEditorBlur() {
    window.getSelection()?.removeAllRanges();
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditingId(null); // cancel
    } else {
      commitLabel();
    }
  }

  return {
    editingId,
    editingT,
    isEditing,
    blurIfDeselected,
    installClickAway,
    onCreateDblclick,
    startEditing,
    editorRef,
    onEditorInput,
    onEditorKeydown,
    onEditorBlur,
  };
}

export type ConnectionLabelEditor = ReturnType<typeof useConnectionLabelEditor>;
