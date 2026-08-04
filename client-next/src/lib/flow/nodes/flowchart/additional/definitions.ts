export type AdditionalFlowchartGeometry =
	| { kind: 'polygon'; points: string }
	| { kind: 'path'; d: string; fillRule?: 'evenodd' }
	| { kind: 'paths'; items: { d: string; filled?: boolean }[] }
	| { kind: 'ellipse' };

interface AdditionalFlowchartDefinition {
	id: string;
	label: string;
	defaultWidth: number;
	defaultHeight: number;
	geometry: AdditionalFlowchartGeometry;
}

/**
 * Shared metadata + normalized geometry for the extra draw.io flowchart
 * symbols. Canvas render (SHAPE_GEOMETRY) and sidebar icons (FlowchartIcon)
 * both read these rows, so their silhouettes can't drift apart.
 *
 * Coords live in the 0–100 viewBox with extremes at 1/99 (preserveAspectRatio
 * "none" stretches to the node box). `paths` with `filled: false` draw
 * stroke-only detail lines over a filled body (e.g. Predefined Process rails).
 */
export const ADDITIONAL_FLOWCHART_DEFINITIONS: readonly AdditionalFlowchartDefinition[] = [
	{
		id: 'PredefinedProcessNode',
		label: 'Predefined Process',
		defaultWidth: 170,
		defaultHeight: 90,
		geometry: {
			kind: 'paths',
			items: [
				{ d: 'M1,1 L99,1 L99,99 L1,99 Z' },
				{ d: 'M12,1 L12,99', filled: false },
				{ d: 'M88,1 L88,99', filled: false }
			]
		}
	},
	{
		id: 'MultipleDocumentsNode',
		label: 'Multiple Documents',
		defaultWidth: 170,
		defaultHeight: 110,
		geometry: {
			kind: 'paths',
			items: [
				{ d: 'M15,1 L99,1 L99,70 L15,70 Z' },
				{ d: 'M8,8 L92,8 L92,77 L8,77 Z' },
				{ d: 'M1,15 L85,15 L85,80 Q64,93 43,80 T1,80 Z' }
			]
		}
	},
	{
		id: 'ManualInputNode',
		label: 'Manual Input',
		defaultWidth: 170,
		defaultHeight: 90,
		// Top edge slopes up left→right.
		geometry: { kind: 'polygon', points: '1,28 99,1 99,99 1,99' }
	},
	{
		id: 'ManualOperationNode',
		label: 'Manual Operation',
		defaultWidth: 170,
		defaultHeight: 90,
		// Trapezoid: wide top, narrow bottom.
		geometry: { kind: 'polygon', points: '1,1 99,1 82,99 18,99' }
	},
	{
		id: 'PreparationNode',
		label: 'Preparation',
		defaultWidth: 170,
		defaultHeight: 90,
		// Elongated horizontal hexagon.
		geometry: { kind: 'polygon', points: '20,1 80,1 99,50 80,99 20,99 1,50' }
	},
	{
		id: 'InternalStorageNode',
		label: 'Internal Storage',
		defaultWidth: 150,
		defaultHeight: 110,
		// Rectangle + a rail near the left + a rail near the top.
		geometry: {
			kind: 'paths',
			items: [
				{ d: 'M1,1 L99,1 L99,99 L1,99 Z' },
				{ d: 'M16,1 L16,99', filled: false },
				{ d: 'M1,17 L99,17', filled: false }
			]
		}
	},
	{
		id: 'StoredDataNode',
		label: 'Stored Data',
		defaultWidth: 160,
		defaultHeight: 90,
		// Curved left + curved right edges (leaning barrel).
		geometry: { kind: 'path', d: 'M13,1 L99,1 Q88,50 99,99 L13,99 Q2,50 13,1 Z' }
	},
	{
		id: 'DisplayNode',
		label: 'Display',
		defaultWidth: 180,
		defaultHeight: 90,
		// Left point, rounded right end.
		geometry: { kind: 'path', d: 'M1,50 L20,1 L70,1 A29,49 0 0 1 70,99 L20,99 Z' }
	},
	{
		id: 'DelayNode',
		label: 'Delay',
		defaultWidth: 150,
		defaultHeight: 90,
		// D-shape: rounded right end.
		geometry: { kind: 'path', d: 'M1,1 L60,1 A39,49 0 0 1 60,99 L1,99 Z' }
	},
	{
		id: 'OnPageConnectorNode',
		label: 'On-Page Connector',
		defaultWidth: 70,
		defaultHeight: 70,
		geometry: { kind: 'ellipse' }
	},
	{
		id: 'OffPageConnectorNode',
		label: 'Off-Page Connector',
		defaultWidth: 100,
		defaultHeight: 110,
		// Home-plate pointing down.
		geometry: { kind: 'polygon', points: '1,1 99,1 99,62 50,99 1,62' }
	},
	{
		id: 'SortNode',
		label: 'Sort',
		defaultWidth: 120,
		defaultHeight: 120,
		// Diamond split by a horizontal line.
		geometry: {
			kind: 'paths',
			items: [{ d: 'M50,1 L99,50 L50,99 L1,50 Z' }, { d: 'M1,50 L99,50', filled: false }]
		}
	},
	{
		id: 'MergeNode',
		label: 'Merge',
		defaultWidth: 130,
		defaultHeight: 110,
		// Downward-pointing triangle.
		geometry: { kind: 'polygon', points: '1,1 99,1 50,99' }
	},
	{
		id: 'AnnotationNode',
		label: 'Annotation',
		defaultWidth: 130,
		defaultHeight: 90,
		// Open left bracket ( [ ), stroke only.
		geometry: { kind: 'paths', items: [{ d: 'M28,1 L1,1 L1,99 L28,99', filled: false }] }
	}
];

export const ADDITIONAL_FLOWCHART_VARIANTS: Record<string, { kind: 'svg' }> = Object.fromEntries(
	ADDITIONAL_FLOWCHART_DEFINITIONS.map(({ id }) => [id, { kind: 'svg' }])
);

export const ADDITIONAL_FLOWCHART_GEOMETRY: Record<string, AdditionalFlowchartGeometry> =
	Object.fromEntries(ADDITIONAL_FLOWCHART_DEFINITIONS.map(({ id, geometry }) => [id, geometry]));
