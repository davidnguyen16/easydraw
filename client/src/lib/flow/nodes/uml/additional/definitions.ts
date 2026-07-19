export type AdditionalUmlGeometry =
	| { kind: 'ellipse' }
	| { kind: 'polygon'; points: string }
	| { kind: 'polygons'; items: string[] }
	| { kind: 'path'; d: string; fillRule?: 'evenodd' }
	| { kind: 'paths'; items: { d: string; filled?: boolean }[] }
	| { kind: 'bullseye' };

export type AdditionalUmlLabelPlacement = 'center' | 'header' | 'below';

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

const THREE_COMPARTMENTS: AdditionalUmlGeometry = {
	kind: 'paths',
	items: [
		{ d: 'M1,1 H99 V99 H1 Z' },
		{ d: 'M1,34 H99', filled: false },
		{ d: 'M1,68 H99', filled: false }
	]
};

const TWO_COMPARTMENTS: AdditionalUmlGeometry = {
	kind: 'paths',
	items: [{ d: 'M1,1 H99 V99 H1 Z' }, { d: 'M1,38 H99', filled: false }]
};

/**
 * Core UML palette metadata and normalized geometry.
 *
 * Both the canvas renderer and the sidebar icons consume these rows. Keeping
 * the dimensions, silhouette, label placement, and defaults together prevents
 * the palette preview from drifting away from the shape that is dropped.
 */
export const ADDITIONAL_UML_DEFINITIONS = [
	{
		id: 'UmlClassNode',
		label: 'Class',
		defaultWidth: 220,
		defaultHeight: 170,
		geometry: THREE_COMPARTMENTS,
		labelPlacement: 'header',
		iconMark: 'C',
		iconFill: 'surface',
		defaultData: { label: 'Class', bold: true }
	},
	{
		id: 'UmlAbstractClassNode',
		label: 'Abstract Class',
		defaultWidth: 220,
		defaultHeight: 170,
		geometry: THREE_COMPARTMENTS,
		labelPlacement: 'header',
		iconMark: 'A',
		iconFill: 'surface',
		defaultData: { label: 'Abstract Class', italic: true }
	},
	{
		id: 'UmlInterfaceNode',
		label: 'Interface',
		defaultWidth: 220,
		defaultHeight: 145,
		geometry: THREE_COMPARTMENTS,
		labelPlacement: 'header',
		iconMark: 'I',
		iconFill: 'surface',
		defaultData: { label: '«interface»\nInterface', fontSize: 12 }
	},
	{
		id: 'UmlEnumerationNode',
		label: 'Enumeration',
		defaultWidth: 220,
		defaultHeight: 165,
		geometry: THREE_COMPARTMENTS,
		labelPlacement: 'header',
		iconMark: 'E',
		iconFill: 'surface',
		defaultData: { label: '«enumeration»\nEnumeration', fontSize: 12 }
	},
	{
		id: 'UmlDataTypeNode',
		label: 'Data Type',
		defaultWidth: 220,
		defaultHeight: 145,
		geometry: THREE_COMPARTMENTS,
		labelPlacement: 'header',
		iconMark: 'T',
		iconFill: 'surface',
		defaultData: { label: '«dataType»\nData Type', fontSize: 12 }
	},
	{
		id: 'UmlObjectInstanceNode',
		label: 'Object / Instance',
		defaultWidth: 220,
		defaultHeight: 140,
		geometry: TWO_COMPARTMENTS,
		labelPlacement: 'header',
		iconMark: 'O',
		iconFill: 'surface',
		defaultData: { label: 'object : Class', underline: true }
	},
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
				{ d: 'M1,1 H99 V99 H1 Z' },
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
				{ d: 'M1,1 H72 L99,28 V99 H1 Z' },
				{ d: 'M72,1 V28 H99', filled: false },
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
			items: [{ d: 'M1,1 H72 L99,28 V99 H1 Z' }, { d: 'M72,1 V28 H99', filled: false }]
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
		id: 'UmlActionActivityNode',
		label: 'Action / Activity',
		defaultWidth: 160,
		defaultHeight: 72,
		geometry: {
			kind: 'path',
			d: 'M13,1 H87 Q99,1 99,13 V87 Q99,99 87,99 H13 Q1,99 1,87 V13 Q1,1 13,1 Z'
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
			items: [
				{
					d: 'M13,1 H87 Q99,1 99,13 V87 Q99,99 87,99 H13 Q1,99 1,87 V13 Q1,1 13,1 Z'
				},
				{ d: 'M1,68 H99', filled: false }
			]
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
		geometry: { kind: 'path', d: 'M1,1 H99 V99 H1 Z' },
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
