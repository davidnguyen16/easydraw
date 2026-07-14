import { Database, GitBranch, Workflow, Network } from '@lucide/svelte';

/** The diagram kinds a user can create. Mirrors the server's allowed `type` values. */
export type DiagramType = 'erd' | 'uml' | 'flowchart' | 'dfd';

export type DiagramTypeMeta = {
	value: DiagramType;
	label: string;
	description: string;
	icon: typeof Database;
};

export const DIAGRAM_TYPES: DiagramTypeMeta[] = [
	{ value: 'erd', label: 'ERD', description: 'Entity-Relationship Diagram', icon: Database },
	{ value: 'uml', label: 'UML', description: 'Class / Sequence Diagram', icon: GitBranch },
	{ value: 'flowchart', label: 'Flowchart', description: 'Process Flow Diagram', icon: Workflow },
	{ value: 'dfd', label: 'DFD', description: 'Data Flow Diagram', icon: Network }
];

/** Look up a type's metadata by its value (falls back to ERD for unknown values). */
export const DIAGRAM_TYPE_MAP: Record<DiagramType, DiagramTypeMeta> = Object.fromEntries(
	DIAGRAM_TYPES.map((t) => [t.value, t])
) as Record<DiagramType, DiagramTypeMeta>;
