/**
 * Connection anchor — an internal, non-palette node type that lets a
 * connection edge have a "floating" endpoint not bound to any real shape.
 *
 * Why this exists
 * ---------------
 * xyflow edges MUST reference real node ids in `source` / `target`; an edge
 * pointing at a non-existent node is silently dropped from the render. So a
 * draw.io-style floating edge end can't just be a loose coordinate — it has
 * to attach to a real (but visually minimal) node. An anchor is that node:
 * a tiny draggable dot. A floating endpoint == an edge end bound to an anchor.
 *
 * Anchors are deliberately kept OUT of the sidebar SHAPES registry — they're
 * an implementation detail of the edge system, never something the user drops
 * from the palette. They're merged into xyflow's `nodeTypes` map directly in
 * Flow.svelte (see ANCHOR_NODE_TYPE usage there).
 */
import type { Node } from '@xyflow/svelte';

/** xyflow node `type` string for connection anchors. */
export const ANCHOR_NODE_TYPE = 'connection-anchor';

/** Handle id rendered by AnchorNode — edges attach to the dot centre here. */
export const ANCHOR_HANDLE_ID = 'a';

/** Box size (px) of the anchor dot. Kept small so it reads as a point. */
export const ANCHOR_SIZE = 12;

/**
 * Builds a floating-endpoint anchor node centred on `position` (flow coords).
 *
 * `origin: [0.5, 0.5]` makes `position` the dot's CENTRE, so the edge endpoint
 * lands exactly where the user released the drag rather than at a corner.
 */
export function createAnchorNode(id: string, position: { x: number; y: number }): Node {
    return {
        id,
        type: ANCHOR_NODE_TYPE,
        position,
        data: {},
        origin: [0.5, 0.5],
        width: ANCHOR_SIZE,
        height: ANCHOR_SIZE
    } satisfies Node;
}

/** True when a node is a connection anchor. */
export function isAnchorNode(node: Node): boolean {
    return node.type === ANCHOR_NODE_TYPE;
}
