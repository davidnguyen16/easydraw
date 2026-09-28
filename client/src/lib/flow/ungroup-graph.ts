import { nanoid } from 'nanoid';
import type { Edge, Node } from '@xyflow/react';
import { buildDiagramScene } from '../diagram3d/scene-model';
import { ungroupSelectedNodes } from './graph-actions';
import { ANCHOR_HANDLE_ID, createAnchorNode } from './nodes/anchor/anchor';

/** Ungroup is not a delete-connections command. Detach group connections to
 * floating endpoints while preserving their edge identities and all content.
 * The caller applies nodes + edges together as a single history transaction. */
export function ungroupSelectedGraph(nodes: Node[], edges: Edge[], createId: () => string = nanoid) {
  const result = ungroupSelectedNodes(nodes);
  if (!result.ungrouped) return { ...result, edges };

  const remainingIds = new Set(result.nodes.map((node) => node.id));
  const removedIds = new Set(nodes.filter((node) => !remainingIds.has(node.id)).map((node) => node.id));
  const connectedIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]).filter((id) => removedIds.has(id)));
  if (!connectedIds.size) return { ...result, edges };

  // Visibility is presentation-only. Even a hidden group's referenced endpoint
  // needs its exact pre-ungroup absolute position, size and inherited elevation.
  // The adapter is pure TypeScript: this does not load Three or browser APIs.
  const absolute = buildDiagramScene(nodes.map((node) => ({ ...node, hidden: false })), [], { origin: [0, 0, 0] });
  const centers = new Map(absolute.nodes.map((node) => [node.id, node.position]));
  const usedIds = new Set(nodes.map((node) => node.id));
  const anchors: Node[] = [];
  const endpointMap = new Map<string, string>();

  for (const group of nodes) {
    if (!connectedIds.has(group.id)) continue;
    const center = centers.get(group.id);
    if (!center) throw new Error(`Cannot preserve the connection endpoint for group ${group.id}.`);
    const id = createId();
    if (!id || usedIds.has(id)) throw new Error('The floating endpoint ID must be unique and non-empty.');
    usedIds.add(id);
    endpointMap.set(group.id, id);
    anchors.push({
      ...createAnchorNode(id, { x: center[0] * 100, y: center[2] * 100 }),
      data: { spatial3d: { depth: 0.02, elevation: center[1] - 0.01 } },
    });
  }

  const nextEdges = edges.map((edge) => {
    const source = endpointMap.get(edge.source);
    const target = endpointMap.get(edge.target);
    if (!source && !target) return edge;
    return {
      ...edge,
      ...(source ? { source, sourceHandle: ANCHOR_HANDLE_ID } : {}),
      ...(target ? { target, targetHandle: ANCHOR_HANDLE_ID } : {}),
    };
  });
  return { ungrouped: true, nodes: [...result.nodes, ...anchors], edges: nextEdges };
}
