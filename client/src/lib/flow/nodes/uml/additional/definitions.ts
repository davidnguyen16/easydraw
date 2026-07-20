export type AdditionalUmlGeometry =
	| { kind: 'ellipse' }
	| { kind: 'polygon'; points: string }
	| { kind: 'polygons'; items: string[] }
	| { kind: 'path'; d: string; fillRule?: 'evenodd' }
	| { kind: 'paths'; items: { d: string; filled?: boolean; dash?: string }[] }
	| { kind: 'bullseye' };

export type AdditionalUmlLabelPlacement = 'center' | 'below' | 'header' | 'top-left' | 'tab';

interface AdditionalUmlDefinition {
	id: string;
	label: string;
	defaultWidth: number;
	defaultHeight: number;
	geometry: AdditionalUmlGeometry;
	labelPlacement: AdditionalUmlLabelPlacement;
	iconMark: string | null;
	iconFill: 'surface' | 'ink';
	defaultData: Record<string, unknown>;
}

// Shared silhouettes used by several UML symbols. Canvas rendering and the
// sidebar icon both consume the same definition rows below, so a geometry fix
// only needs to be made once.
const RECTANGLE_PATH = 'M1,1 H99 V99 H1 Z';
const ROUNDED_RECTANGLE_PATH =
	'M13,1 H87 Q99,1 99,13 V87 Q99,99 87,99 H13 Q1,99 1,87 V13 Q1,1 13,1 Z';
const FOLDED_CORNER_PATH = 'M1,1 H72 L99,28 V99 H1 Z';
const FOLD_LINE_PATH = 'M72,1 V28 H99';
const OUTLINED_RECTANGLE = { d: RECTANGLE_PATH, filled: false };

/**
 * Core UML palette metadata and normalized geometry.
 *
 * Both the canvas renderer and the sidebar icons consume these rows. Keeping
 * the dimensions, silhouette, label placement, and defaults together prevents
 * the palette preview from drifting away from the shape that is dropped.
 */
export const ADDITIONAL_UML_DEFINITIONS = [
	{
		id: 'UmlPackageNode',
		label: 'Package',
		defaultWidth: 190,
		defaultHeight: 120,
		geometry: { kind: 'path', d: 'M1,1 H55 V18 H99 V99 H1 Z' },
		labelPlacement: 'center',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'Package' }
	},
	{
		id: 'UmlComponentNode',
		label: 'Component',
		defaultWidth: 180,
		defaultHeight: 110,
		geometry: {
			kind: 'paths',
			items: [
				{ d: RECTANGLE_PATH },
				{ d: 'M10,20 H28 V42 H10 Z', filled: false },
				{ d: 'M5,24 H14 V30 H5 Z', filled: false },
				{ d: 'M5,33 H14 V39 H5 Z', filled: false }
			]
		},
		labelPlacement: 'center',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'Component' }
	},
	{
		id: 'UmlPortNode',
		label: 'Port',
		defaultWidth: 32,
		defaultHeight: 32,
		geometry: { kind: 'path', d: RECTANGLE_PATH },
		labelPlacement: 'below',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'Port', fontSize: 12 }
	},
	{
		id: 'UmlDeploymentNode',
		label: 'Deployment Node',
		defaultWidth: 180,
		defaultHeight: 130,
		geometry: {
			kind: 'polygons',
			items: ['1,20 18,1 99,1 82,20', '1,20 82,20 82,99 1,99', '82,20 99,1 99,80 82,99']
		},
		labelPlacement: 'center',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'Deployment Node' }
	},
	{
		id: 'UmlArtifactNode',
		label: 'Artifact',
		defaultWidth: 170,
		defaultHeight: 110,
		geometry: {
			kind: 'paths',
			items: [
				{ d: FOLDED_CORNER_PATH },
				{ d: FOLD_LINE_PATH, filled: false },
				{ d: 'M13,18 H31 V38 H13 Z', filled: false },
				{ d: 'M9,22 H17 V28 H9 Z', filled: false },
				{ d: 'M9,30 H17 V36 H9 Z', filled: false }
			]
		},
		labelPlacement: 'center',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: '«artifact»\nArtifact', fontSize: 12 }
	},
	{
		id: 'UmlNoteCommentNode',
		label: 'Note / Comment',
		defaultWidth: 170,
		defaultHeight: 110,
		geometry: {
			kind: 'paths',
			items: [{ d: FOLDED_CORNER_PATH }, { d: FOLD_LINE_PATH, filled: false }]
		},
		labelPlacement: 'center',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'Note' }
	},
	{
		id: 'UmlConstraintNode',
		label: 'Constraint',
		defaultWidth: 160,
		defaultHeight: 60,
		geometry: {
			kind: 'paths',
			items: [
				{ d: 'M34,1 C18,1 24,40 8,40 C24,40 18,99 34,99', filled: false },
				{ d: 'M66,1 C82,1 76,40 92,40 C76,40 82,99 66,99', filled: false }
			]
		},
		labelPlacement: 'center',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'constraint', fontSize: 12 }
	},
	{
		id: 'UmlUseCaseNode',
		label: 'Use Case',
		defaultWidth: 180,
		defaultHeight: 100,
		geometry: { kind: 'ellipse' },
		labelPlacement: 'center',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'Use Case' }
	},
	{
		id: 'UmlSystemBoundaryNode',
		label: 'System Boundary',
		defaultWidth: 340,
		defaultHeight: 230,
		geometry: {
			kind: 'paths',
			items: [OUTLINED_RECTANGLE]
		},
		labelPlacement: 'top-left',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'System Boundary', fontSize: 12, bold: true, textAlign: 'left' }
	},
	{
		id: 'UmlLifelineNode',
		label: 'Lifeline',
		defaultWidth: 140,
		defaultHeight: 260,
		geometry: {
			kind: 'paths',
			items: [{ d: 'M10,1 H90 V22 H10 Z' }, { d: 'M50,22 V99', filled: false, dash: '6 5' }]
		},
		labelPlacement: 'header',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'Lifeline', fontSize: 12 }
	},
	{
		id: 'UmlActivationNode',
		label: 'Activation',
		defaultWidth: 32,
		defaultHeight: 150,
		geometry: { kind: 'path', d: 'M28,1 H72 V99 H28 Z' },
		labelPlacement: 'below',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'Activation', fontSize: 12 }
	},
	{
		id: 'UmlCombinedFragmentNode',
		label: 'Combined Fragment',
		defaultWidth: 320,
		defaultHeight: 210,
		geometry: {
			kind: 'paths',
			items: [OUTLINED_RECTANGLE, { d: 'M1,1 H28 V12 L23,18 H1 Z', filled: false }]
		},
		labelPlacement: 'tab',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'alt', fontSize: 12, bold: true, textAlign: 'left' }
	},
	{
		id: 'UmlActivityPartitionNode',
		label: 'Activity Partition / Swimlane',
		defaultWidth: 280,
		defaultHeight: 180,
		geometry: {
			kind: 'paths',
			items: [OUTLINED_RECTANGLE, { d: 'M1,20 H99', filled: false }]
		},
		labelPlacement: 'header',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'Activity Partition / Swimlane', fontSize: 12, bold: true }
	},
	{
		id: 'UmlActionActivityNode',
		label: 'Action / Activity',
		defaultWidth: 160,
		defaultHeight: 72,
		geometry: {
			kind: 'path',
			d: ROUNDED_RECTANGLE_PATH
		},
		labelPlacement: 'center',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'Action' }
	},
	{
		id: 'UmlStateNode',
		label: 'State',
		defaultWidth: 180,
		defaultHeight: 92,
		geometry: {
			kind: 'paths',
			items: [{ d: ROUNDED_RECTANGLE_PATH }, { d: 'M1,68 H99', filled: false }]
		},
		labelPlacement: 'center',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: 'State' }
	},
	{
		id: 'UmlInitialNode',
		label: 'Initial Node',
		defaultWidth: 60,
		defaultHeight: 60,
		geometry: { kind: 'ellipse' },
		labelPlacement: 'below',
		iconMark: null,
		iconFill: 'ink',
		defaultData: { label: '', fillColor: '#2c2c2a', borderColor: '#2c2c2a' }
	},
	{
		id: 'UmlFinalNode',
		label: 'Final Node',
		defaultWidth: 70,
		defaultHeight: 70,
		geometry: { kind: 'bullseye' },
		labelPlacement: 'below',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: '' }
	},
	{
		id: 'UmlDecisionMergeNode',
		label: 'Decision / Merge',
		defaultWidth: 86,
		defaultHeight: 86,
		geometry: { kind: 'polygon', points: '50,1 99,50 50,99 1,50' },
		labelPlacement: 'below',
		iconMark: null,
		iconFill: 'surface',
		defaultData: { label: '' }
	},
	{
		id: 'UmlForkJoinNode',
		label: 'Fork / Join',
		defaultWidth: 160,
		defaultHeight: 30,
		geometry: { kind: 'path', d: RECTANGLE_PATH },
		labelPlacement: 'below',
		iconMark: null,
		iconFill: 'ink',
		defaultData: { label: '', fillColor: '#2c2c2a', borderColor: '#2c2c2a' }
	}
] as const satisfies readonly AdditionalUmlDefinition[];

export type AdditionalUmlId = (typeof ADDITIONAL_UML_DEFINITIONS)[number]['id'];

export const ADDITIONAL_UML_DEFINITION_BY_ID = Object.fromEntries(
	ADDITIONAL_UML_DEFINITIONS.map((definition) => [definition.id, definition])
) as Record<AdditionalUmlId, (typeof ADDITIONAL_UML_DEFINITIONS)[number]>;

export const ADDITIONAL_UML_VARIANTS = Object.fromEntries(
	ADDITIONAL_UML_DEFINITIONS.map(({ id, labelPlacement }) => [
		id,
		{ kind: 'svg' as const, labelPlacement }
	])
) as Record<AdditionalUmlId, { kind: 'svg'; labelPlacement: AdditionalUmlLabelPlacement }>;

export const ADDITIONAL_UML_GEOMETRY = Object.fromEntries(
	ADDITIONAL_UML_DEFINITIONS.map(({ id, geometry }) => [id, geometry])
) as Record<AdditionalUmlId, AdditionalUmlGeometry>;
