import { nanoid } from 'nanoid';
import type { Edge, Node } from '@xyflow/react';
import { ANCHOR_NODE_TYPE } from './nodes/anchor/anchor';

export interface ClipboardSnapshot {
	nodes: Node[];
	edges: Edge[];
}

export const PASTE_OFFSET_STEP = 32;

type OnEditFactory = (nodeId: string) => (newData: Record<string, unknown>) => void;

const finite = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const spatial = (node: Node): Record<string, unknown> => node.data.spatial3d && typeof node.data.spatial3d === 'object' && !Array.isArray(node.data.spatial3d)
	? node.data.spatial3d as Record<string, unknown> : {};
const elevation = (node: Node) => finite(spatial(node).elevation, node.parentId ? 0 : 0.04);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function dimension(...values: unknown[]) {
	for (const value of values) {
		const parsed = typeof value === 'string' && /^\d+(\.\d+)?(px)?$/.test(value) ? Number.parseFloat(value) : finite(value);
		if (parsed > 0) return Math.min(100_000, parsed);
	}
	return 100;
}
function size(node: Node) {
	return {
		width: dimension(node.width, node.style?.width, node.measured?.width, node.initialWidth, 150),
		height: dimension(node.height, node.style?.height, node.measured?.height, node.initialHeight, 80),
	};
}
function topLeft(node: Node) {
	const dimensions = size(node);
	return { x: finite(node.position.x) - dimensions.width * finite(node.origin?.[0]), y: finite(node.position.y) - dimensions.height * finite(node.origin?.[1]) };
}
function protectedAncestors(nodes: Node[], predicate: (node: Node) => boolean) {
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const protectedIds = new Set<string>();
	for (const node of nodes.filter(predicate)) {
		let current: Node | undefined = node;
		while (current && !protectedIds.has(current.id)) {
			protectedIds.add(current.id);
			current = current.parentId ? byId.get(current.parentId) : undefined;
		}
	}
	return protectedIds;
}

export function duplicateSelectedNodes(nodes: Node[], createOnEdit: OnEditFactory): Node[] {
	const snapshot = copySelection(nodes, []);
	return snapshot ? pasteSnapshot(nodes, [], snapshot, 30 / PASTE_OFFSET_STEP, createOnEdit).nodes : nodes;
}

export function deleteSelectedGraph(nodes: Node[], edges: Edge[]) {
	// Deleting a group must not silently remove one of its locked descendants.
	const protectedIds = protectedAncestors(nodes, (item) => Boolean(item.data.locked) || item.deletable === false);
	const removed = new Set(nodes.filter((node) => node.selected && !protectedIds.has(node.id)).map((node) => node.id));
	let expanded = true;
	while (expanded) {
		expanded = false;
		for (const node of nodes) if (node.parentId && removed.has(node.parentId) && !removed.has(node.id)) { removed.add(node.id); expanded = true; }
	}
	const nextEdges = edges.filter((edge) => !(edge.selected && edge.deletable !== false && !edge.data?.locked) && !removed.has(edge.source) && !removed.has(edge.target));
	const references = new Set(nextEdges.flatMap((edge) => [edge.source, edge.target]));
	const nextNodes = nodes.filter((node) => !removed.has(node.id) && (node.type !== ANCHOR_NODE_TYPE || references.has(node.id) || protectedIds.has(node.id)));
	return { changed: nextNodes.length !== nodes.length || nextEdges.length !== edges.length, nodes: nextNodes, edges: nextEdges };
}

export function selectAllGraph(nodes: Node[], edges: Edge[]) {
	return {
		nodes: nodes.map((node) =>
			node.type === ANCHOR_NODE_TYPE ? node : { ...node, selected: true }
		),
		edges: edges.map((edge) => ({ ...edge, selected: true }))
	};
}

export function copySelection(nodes: Node[], edges: Edge[]): ClipboardSnapshot | null {
	const selectedIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
	let expanded = true;
	while (expanded) {
		expanded = false;
		for (const node of nodes) if (node.parentId && selectedIds.has(node.parentId) && !selectedIds.has(node.id)) { selectedIds.add(node.id); expanded = true; }
	}
	for (const edge of edges.filter((item) => item.selected)) {
		for (const node of nodes) if (node.type === ANCHOR_NODE_TYPE && (edge.source === node.id || edge.target === node.id)) selectedIds.add(node.id);
	}
	const selectedEdges = edges.filter(
		(edge) => edge.selected || (selectedIds.has(edge.source) && selectedIds.has(edge.target))
	);
	if (!selectedIds.size && !selectedEdges.length) return null;
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const selectedNodes = nodes.filter((node) => selectedIds.has(node.id)).map((node) => {
		if (!node.parentId || selectedIds.has(node.parentId)) return node;
		// A child copied without its parent becomes a top-level object at its
		// original world position rather than retaining a stale parent id.
		const position = { ...node.position };
		let worldElevation = elevation(node);
		let parent = byId.get(node.parentId);
		const seen = new Set([node.id]);
		while (parent && !seen.has(parent.id)) {
			seen.add(parent.id);
			const parentOffset = topLeft(parent);
			position.x += parentOffset.x; position.y += parentOffset.y;
			worldElevation += elevation(parent);
			parent = parent.parentId ? byId.get(parent.parentId) : undefined;
		}
		return { ...node, parentId: undefined, extent: undefined, position, data: { ...node.data, spatial3d: { ...spatial(node), elevation: worldElevation } } };
	});

	return {
		nodes: clone(selectedNodes),
		edges: clone(selectedEdges)
	};
}

export function pasteSnapshot(
	nodes: Node[],
	edges: Edge[],
	snapshot: ClipboardSnapshot,
	pasteCount: number,
	createOnEdit: OnEditFactory
) {
	const idMap = new Map<string, string>();
	const offset = PASTE_OFFSET_STEP * Math.max(0, Math.min(10_000, finite(pasteCount, 1)));
	for (const node of snapshot.nodes) idMap.set(node.id, nanoid());

	const pastedNodes = clone(snapshot.nodes).map((node) => {
		const newId = idMap.get(node.id)!;
		const parentId = node.parentId ? idMap.get(node.parentId) : undefined;
		return {
			...node,
			id: newId,
			parentId,
			extent: parentId ? node.extent : undefined,
			position: { x: node.position.x + (parentId ? 0 : offset), y: node.position.y + (parentId ? 0 : offset) },
			selected: !parentId && node.type !== ANCHOR_NODE_TYPE,
			data: {
				...node.data,
				onEdit: createOnEdit(newId)
			}
		} as Node;
	});

	const availableIds = new Set([...nodes, ...pastedNodes].map((node) => node.id));
	const pastedEdges = clone(snapshot.edges).map((edge) => ({
		...edge,
		id: nanoid(),
		source: idMap.get(edge.source) ?? edge.source,
		target: idMap.get(edge.target) ?? edge.target,
		selected: true,
		data: {
			...(edge.data ?? {}),
			...(Array.isArray(edge.data?.bendPoints) ? { bendPoints: edge.data.bendPoints.map((point: { x: number; y: number; z?: number }) => ({ ...point,
				x: point.x + (idMap.has(edge.source) && idMap.has(edge.target) ? offset : 0),
				y: point.y + (idMap.has(edge.source) && idMap.has(edge.target) ? offset : 0),
			})) } : {}),
		},
	})).filter((edge) => availableIds.has(edge.source) && availableIds.has(edge.target));

	return {
		nodes: [...nodes.map((node) => ({ ...node, selected: false })), ...pastedNodes],
		edges: [...edges.map((edge) => ({ ...edge, selected: false })), ...pastedEdges]
	};
}

export function bringSelectedToFront(nodes: Node[]): Node[] {
	const selected = nodes.filter((node) => node.selected);
	if (selected.length === 0) return nodes;
	const others = nodes.filter((node) => !node.selected);
	return [...others, ...selected];
}

export function sendSelectedToBack(nodes: Node[]): Node[] {
	const selected = nodes.filter((node) => node.selected);
	if (selected.length === 0) return nodes;
	const others = nodes.filter((node) => !node.selected);
	return [...selected, ...others];
}

export function bringSelectedForward(nodes: Node[]): Node[] {
	if (!nodes.some((node) => node.selected)) return nodes;
	const next = [...nodes];
	for (let i = next.length - 2; i >= 0; i--) {
		if (next[i].selected && !next[i + 1].selected) {
			[next[i], next[i + 1]] = [next[i + 1], next[i]];
		}
	}
	return next;
}

export function sendSelectedBackward(nodes: Node[]): Node[] {
	if (!nodes.some((node) => node.selected)) return nodes;
	const next = [...nodes];
	for (let i = 1; i < next.length; i++) {
		if (next[i].selected && !next[i - 1].selected) {
			[next[i], next[i - 1]] = [next[i - 1], next[i]];
		}
	}
	return next;
}

export function toggleNodeLock(nodes: Node[], id: string): Node[] {
	return nodes.map((node) => {
		if (node.id !== id) return node;
		const locked = !node.data.locked;
		return {
			...node,
			draggable: !locked,
			connectable: !locked,
			deletable: !locked,
			data: { ...node.data, locked }
		};
	});
}

export function groupSelectedNodes(nodes: Node[]) {
	const selected = nodes.filter(
		(node) => node.selected && !node.parentId && !node.data.locked && node.draggable !== false && node.type !== ANCHOR_NODE_TYPE
	);
	if (selected.length < 2) {
		return { grouped: false, nodes };
	}

	const padding = 24;
	const minX = Math.min(...selected.map((node) => topLeft(node).x));
	const minY = Math.min(...selected.map((node) => topLeft(node).y));
	const maxX = Math.max(
		...selected.map((node) => topLeft(node).x + size(node).width)
	);
	const maxY = Math.max(
		...selected.map((node) => topLeft(node).y + size(node).height)
	);

	const groupId = nanoid();
	const groupNode = {
		id: groupId,
		type: 'group',
		position: { x: minX - padding, y: minY - padding },
		data: { spatial3d: { elevation: 0 } },
		selected: true,
		// React needs a CSSProperties object here — a CSS *string* (what the
		// SvelteKit app wrote) makes React assign into CSSStyleDeclaration by
		// index and throw "Indexed property setter is not supported".
		style: { width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 }
	} as unknown as Node;

	const selectedIds = new Set(selected.map((node) => node.id));
	return {
		grouped: true,
		nodes: [
			groupNode,
			...nodes.map((node) => {
				if (!selectedIds.has(node.id)) return node;
				return {
					...node,
					parentId: groupId,
					data: { ...node.data, spatial3d: { ...spatial(node), elevation: elevation(node) } },
					extent: 'parent' as const,
					position: {
						x: node.position.x - (minX - padding),
						y: node.position.y - (minY - padding)
					},
					selected: false
				};
			})
		] as Node[]
	};
}

export function ungroupSelectedNodes(nodes: Node[]) {
	const protectedIds = protectedAncestors(nodes, (node) => Boolean(node.data.locked) || node.deletable === false || node.draggable === false);
	const selectedGroups = nodes.filter((node) => node.selected && node.type === 'group' && !protectedIds.has(node.id));
	if (selectedGroups.length === 0) {
		return { ungrouped: false, nodes };
	}

	const groupIds = new Set(selectedGroups.map((group) => group.id));
	const groupById = new Map(selectedGroups.map((group) => [group.id, group]));

	return {
		ungrouped: true,
		nodes: nodes
			.filter((node) => !groupIds.has(node.id))
			.map((node) => {
				const parentId = node.parentId;
				if (parentId && groupIds.has(parentId)) {
					let ancestor: string | undefined = parentId;
					let combinedElevation = elevation(node);
					const position = { ...node.position };
					const seen = new Set<string>([node.id]);
					while (ancestor && groupIds.has(ancestor) && !seen.has(ancestor)) {
						seen.add(ancestor);
						const parent: Node = groupById.get(ancestor)!;
						const parentOffset = topLeft(parent);
						position.x += parentOffset.x; position.y += parentOffset.y;
						combinedElevation += elevation(parent);
						ancestor = parent.parentId;
					}
					if (ancestor && groupIds.has(ancestor)) ancestor = undefined;
					return {
						...node, parentId: ancestor, extent: ancestor ? node.extent : undefined, selected: true,
						data: { ...node.data, spatial3d: { ...spatial(node), elevation: combinedElevation } },
						position,
					} as Node;
				}
				return node;
			})
	};
}
