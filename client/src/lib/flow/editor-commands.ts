import type { Node, Edge } from '@xyflow/react';
import { useFlowStore } from './flow-store';
import { recordSnapshot } from '@/lib/stores/history.store';

// Selection and DOM measurements are view state, never standalone undo steps.
export function graphHistorySnapshot(nodes: Node[], edges: Edge[]): string {
  const contentNodes = nodes.map((node) => {
    const { selected: _selected, dragging: _dragging, measured: _measured, ...content } = node;
    void _selected; void _dragging; void _measured;
    return content;
  });
  const contentEdges = edges.map((edge) => {
    const { selected: _selected, ...content } = edge;
    void _selected;
    return content;
  });
  return JSON.stringify({ nodes: contentNodes, edges: contentEdges });
}

let gestureActive = false;
export const isGraphGestureActive = () => gestureActive;

function recordCurrentGraph() {
  const { nodes, edges } = useFlowStore.getState();
  recordSnapshot(graphHistorySnapshot(nodes, edges));
}

/** All renderers share the same command history. Continuous gizmo drags are one command. */
export function beginGraphGesture() {
  if (!gestureActive) recordCurrentGraph();
  gestureActive = true;
}

export function endGraphGesture() {
  gestureActive = false;
  recordCurrentGraph();
}

export function runGraphCommand(action: () => void) {
  // A continuous gesture owns its immutable baseline until mouse-up. Running
  // another command now would be overwritten by the next drag frame.
  if (gestureActive) return;
  recordCurrentGraph();
  action();
  recordCurrentGraph();
}
