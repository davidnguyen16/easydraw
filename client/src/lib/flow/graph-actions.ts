import { nanoid } from 'nanoid';
import type { Edge, Node } from '@xyflow/svelte';
import { ANCHOR_NODE_TYPE } from './nodes/anchor/anchor';

export interface ClipboardSnapshot {
	nodes: Node[];
	edges: Edge[];
}

export const PASTE_OFFSET_STEP = 32;

type OnEditFactory = (nodeId: string) => (newData: any) => void;

export function duplicateSelectedNodes(nodes: Node[], createOnEdit: OnEditFactory): Node[] {
	const selected = nodes.filter((node) => node.selected);
	if (selected.length === 0) return nodes;

	const copies = selected.map((node) => {
		const newId = nanoid();
		return {
			...node,
			id: newId,
			position: { x: node.position.x + 30, y: node.position.y + 30 },
			selected: false,
			data: {
				...node.data,
				onEdit: createOnEdit(newId)
			}
		};
	});

	return [...nodes.map((node) => ({ ...node, selected: false })), ...copies];
}

export function deleteSelectedGraph(nodes: Node[], edges: Edge[]) {
	const hasSelectedNodes = nodes.some((node) => node.selected);
	const hasSelectedEdges = edges.some((edge) => edge.selected);

	return {
		changed: hasSelectedNodes || hasSelectedEdges,
		nodes: hasSelectedNodes
			? nodes.filter((node) => !node.selected || (node.data as any)?.locked)
			: nodes,
		edges: hasSelectedEdges ? edges.filter((edge) => !edge.selected) : edges
	};
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
	const selectedNodes = nodes.filter((node) => node.selected);
	if (selectedNodes.length === 0) return null;

	const selectedIds = new Set(selectedNodes.map((node) => node.id));
	const selectedEdges = edges.filter(
		(edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)
	);

	return {
		nodes: JSON.parse(JSON.stringify(selectedNodes)),
		edges: JSON.parse(JSON.stringify(selectedEdges))
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
	const offset = PASTE_OFFSET_STEP * pasteCount;

	const pastedNodes = snapshot.nodes.map((node) => {
		const newId = nanoid();
		idMap.set(node.id, newId);
		return {
			...node,
			id: newId,
			position: { x: node.position.x + offset, y: node.position.y + offset },
			selected: true,
			data: {
				...node.data,
				onEdit: createOnEdit(newId)
			}
		} as Node;
	});

	const pastedEdges = snapshot.edges.map((edge) => ({
		...edge,
		id: nanoid(),
		source: idMap.get(edge.source) ?? edge.source,
		target: idMap.get(edge.target) ?? edge.target,
		selected: true
	}));

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
		const locked = !(node.data as any)?.locked;
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
		(node) => node.selected && !(node as any).parentId && node.type !== ANCHOR_NODE_TYPE
	);
	if (selected.length < 2) {
		return { grouped: false, nodes };
	}

	const padding = 24;
	const minX = Math.min(...selected.map((node) => node.position.x));
	const minY = Math.min(...selected.map((node) => node.position.y));
	const maxX = Math.max(
		...selected.map((node) => node.position.x + ((node as any).width ?? node.measured?.width ?? 150))
	);
	const maxY = Math.max(
		...selected.map((node) => node.position.y + ((node as any).height ?? node.measured?.height ?? 80))
	);

	const groupId = nanoid();
	const groupNode = {
		id: groupId,
		type: 'group',
		position: { x: minX - padding, y: minY - padding },
		data: {},
		style: `width: ${maxX - minX + padding * 2}px; height: ${maxY - minY + padding * 2}px;`
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
	const selectedGroups = nodes.filter((node) => node.selected && node.type === 'group');
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
				const parentId = (node as any).parentId as string | undefined;
				if (parentId && groupIds.has(parentId)) {
					const parent = groupById.get(parentId)!;
					const { parentId: _drop, extent: _drop2, ...rest } = node as any;
					return {
						...rest,
						position: {
							x: parent.position.x + node.position.x,
							y: parent.position.y + node.position.y
						}
					} as Node;
				}
				return node;
			})
	};
}
