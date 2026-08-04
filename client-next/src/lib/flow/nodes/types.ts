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
import type { ComponentType } from 'react';
import type { Node, NodeProps } from '@xyflow/react';

/** Sidebar palette grouping. Add new values here as new categories appear. */
export type NodeCategory = 'basic' | 'arrows' | 'flowchart' | 'entity-relation' | 'uml' | 'network';

/** Stable ids for nested palette groups. Display labels live in Sidebar. */
export type PaletteGroupId =
	| 'network-devices'
	| 'security-traffic'
	| 'end-devices'
	| 'servers-storage'
	| 'wan-cloud'
	| 'zones-containers'
	| 'connections';

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
	component: ComponentType<NodePanelProps>;
}

export interface NodeShape {
	/**
	 * xyflow node `type` string. Must be unique across the registry AND end
	 * in "Node" — xy-theme.css strips xyflow's default card styling from all
	 * `svelte-flow__node-*Node` classes via a [class*='Node'] selector, so a
	 * shape id without the suffix keeps the white wrapper by (their) design.
	 */
	id: string;
	/** Display name in the sidebar palette tile and tooltip. */
	label: string;
	/** Sidebar palette grouping. */
	category: NodeCategory;
	/** Optional nested group within a sidebar category. Palette-only metadata. */
	paletteGroup?: PaletteGroupId;
	/** Extra palette search terms such as abbreviations and common aliases. */
	searchAliases?: readonly string[];
	/**
	 * The Svelte component xyflow renders for this node. Omitted only for
	 * connection-preset tiles (`edgePreset` set) — those never render a node,
	 * so they're skipped when building the xyflow nodeTypes map.
	 */
	component?: ComponentType<NodeProps>;
	/** SVG icon component rendered inside the sidebar palette tile. */
	icon: ComponentType<any>;
	/** Optional props forwarded only to the sidebar palette icon. */
	paletteIconProps?: Record<string, unknown>;
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
	/** Optional initial canvas stacking order applied when the shape is dropped. */
	defaultZIndex?: number;
	/** Shape-specific editor surface added as a tab in StylePanel. Optional. */
	panel?: NodePanel;
	/**
	 * Hide the shape from the sidebar palette while KEEPING it registered in
	 * the xyflow nodeTypes map. Use when retiring a shape from the catalog:
	 * saved diagrams that already contain it must still render.
	 */
	hidden?: boolean;
	/**
	 * Connection-preset tile: dropping it creates a free-floating CONNECTION
	 * (two anchor endpoints + one `connection` edge) instead of a node — the
	 * same construct as detaching both ends of a connection, so it's styled
	 * via ConnectionStylePanel and rigid-moves as one object. Given the drop
	 * point (flow coords), returns both endpoint positions and the edge's
	 * initial `data` (bendPoints / markers / …). Needs no `component`.
	 */
	edgePreset?: (center: { x: number; y: number }) => {
		source: { x: number; y: number };
		target: { x: number; y: number };
		data: Record<string, unknown>;
	};
}
