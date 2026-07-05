/**
 * Node shape contract.
 *
 * Each node "shape" is a self-contained module: its visual component, its
 * sidebar palette icon, its default data, and (optionally) a right-panel
 * surface for shape-specific editing. New shapes are added by:
 *
 *   1. Creating a folder under src/lib/flow/nodes/<section>/<name>/
 *      (sections mirror the sidebar categories: basic/, arrows/, …)
 *   2. Exporting one or more NodeShape entries from a shape.ts in that folder
 *   3. Adding the shape(s) to the SHAPES array in registry.ts
 *
 * Everything downstream (xyflow nodeTypes map, sidebar palette, drop-default
 * data, StylePanel custom tabs) is derived from the registry — no fan-out
 * editing required when the catalog grows.
 */
import type { Component } from 'svelte';
import type { Node, NodeProps } from '@xyflow/svelte';

/** Sidebar palette grouping. Add new values here as new categories appear. */
export type NodeCategory = 'basic' | 'arrows' | 'flowchart' | 'database' | 'uml';

/**
 * Optional StylePanel surface that's only relevant to specific shapes.
 * Renders as an additional tab in StylePanel when the selected node's shape
 * declares one. The panel receives the live node + a generic data-patch
 * callback so it can update whatever it needs without StylePanel knowing.
 */
export interface NodePanelProps {
	node: Node;
	onDataChange: (patch: Record<string, unknown>) => void;
}

export interface NodePanel {
	/** Tab label shown in StylePanel (e.g. "Fields"). */
	label: string;
	component: Component<NodePanelProps>;
}

export interface NodeShape {
	/** xyflow node `type` string. Must be unique across the registry. */
	id: string;
	/** Display name in the sidebar palette tile and tooltip. */
	label: string;
	/** Sidebar palette grouping. */
	category: NodeCategory;
	/** The Svelte component xyflow renders for this node. */
	component: Component<NodeProps>;
	/** SVG icon component rendered inside the sidebar palette tile. */
	icon: Component;
	/** Returns the initial data payload when a tile of this shape is dropped. */
	defaultData: () => Record<string, unknown>;
	/**
	 * Initial bounding-box dimensions applied to the node on drop. Optional —
	 * when omitted, xyflow auto-sizes the node from its content. Use this for
	 * shapes whose identity depends on an aspect ratio: a Circle must drop as
	 * a square box (1:1), an Ellipse needs a wider box, etc. The user can
	 * still resize freely afterwards.
	 */
	defaultWidth?: number;
	defaultHeight?: number;
	/** Shape-specific editor surface added as a tab in StylePanel. Optional. */
	panel?: NodePanel;
	/**
	 * Hide the shape from the sidebar palette while KEEPING it registered in
	 * the xyflow nodeTypes map. Use when retiring a shape from the catalog:
	 * saved diagrams that already contain it must still render.
	 */
	hidden?: boolean;
}
