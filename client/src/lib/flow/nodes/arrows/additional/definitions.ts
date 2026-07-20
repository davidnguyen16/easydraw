export type AdditionalArrowGeometry =
	| { kind: 'polygon'; points: string }
	| { kind: 'path'; d: string; fillRule?: 'evenodd' };

interface AdditionalArrowDefinition {
	id: string;
	label: string;
	defaultWidth: number;
	defaultHeight: number;
	geometry: AdditionalArrowGeometry;
}

/**
 * Shared metadata and normalized geometry for the additional Arrow palette.
 * The canvas and sidebar icons both consume these rows, so their silhouettes
 * cannot drift apart when a path is adjusted later.
 */
export const ADDITIONAL_ARROW_DEFINITIONS = [
	{
		id: 'UpDownArrowNode',
		label: 'Up-Down Arrow',
		defaultWidth: 100,
		defaultHeight: 200,
		geometry: {
			kind: 'polygon',
			points: '50,1 99,25 70,25 70,75 99,75 50,99 1,75 30,75 30,25 1,25'
		}
	},
	{
		id: 'ThreeWayArrowNode',
		label: 'Three-Way Arrow',
		defaultWidth: 150,
		defaultHeight: 150,
		geometry: {
			kind: 'polygon',
			points: '50,1 65,25 57,25 57,43 75,43 75,35 99,50 75,65 75,57 57,57 57,99 43,99 43,57 25,57 25,65 1,50 25,35 25,43 43,43 43,25 35,25'
		}
	},
	{
		id: 'SplitArrowNode',
		label: 'Split Arrow',
		defaultWidth: 160,
		defaultHeight: 130,
		geometry: {
			kind: 'polygon',
			points: '1,42 40,42 62,20 55,13 82,1 94,29 87,22 59,50 87,78 94,71 82,99 55,87 62,80 40,58 1,58'
		}
	},
	{
		id: 'MergeArrowNode',
		label: 'Merge Arrow',
		defaultWidth: 160,
		defaultHeight: 130,
		geometry: {
			kind: 'polygon',
			points: '1,8 25,8 55,38 65,38 65,20 99,50 65,80 65,62 55,62 25,92 1,92 1,68 30,50 1,32'
		}
	},
	{
		id: 'CurvedRightArrowNode',
		label: 'Curved Right Arrow',
		defaultWidth: 140,
		defaultHeight: 140,
		geometry: {
			kind: 'path',
			d: 'M1,99 L1,50 A49,49 0 0 1 50,1 L70,1 L99,25 L70,49 L70,25 L50,25 A25,25 0 0 0 25,50 L25,99 Z'
		}
	},
	{
		id: 'CurvedLeftArrowNode',
		label: 'Curved Left Arrow',
		defaultWidth: 140,
		defaultHeight: 140,
		geometry: {
			kind: 'path',
			d: 'M99,99 L99,50 A49,49 0 0 0 50,1 L30,1 L1,25 L30,49 L30,25 L50,25 A25,25 0 0 1 75,50 L75,99 Z'
		}
	},
	{
		id: 'CurvedUpArrowNode',
		label: 'Curved Up Arrow',
		defaultWidth: 140,
		defaultHeight: 140,
		geometry: {
			kind: 'path',
			d: 'M99,99 L50,99 A49,49 0 0 1 1,50 L1,30 L25,1 L49,30 L25,30 L25,50 A25,25 0 0 0 50,75 L99,75 Z'
		}
	},
	{
		id: 'CurvedDownArrowNode',
		label: 'Curved Down Arrow',
		defaultWidth: 140,
		defaultHeight: 140,
		geometry: {
			kind: 'path',
			d: 'M1,1 L50,1 A49,49 0 0 1 99,50 L99,70 L75,99 L51,70 L75,70 L75,50 A25,25 0 0 0 50,25 L1,25 Z'
		}
	},
	{
		id: 'CircularArrowClockwiseNode',
		label: 'Circular Arrow Clockwise',
		defaultWidth: 150,
		defaultHeight: 150,
		geometry: {
			kind: 'path',
			fillRule: 'evenodd',
			d: 'M50,1 C22,2 1,23 1,50 C1,77 23,99 50,99 C77,99 99,77 99,50 C99,39 94,29 86,21 L99,12 L72,1 L74,24 C80,31 83,40 83,50 C83,68 68,83 50,83 C32,83 17,68 17,50 C17,32 31,18 50,17 Z'
		}
	},
	{
		id: 'CircularArrowCounterclockwiseNode',
		label: 'Circular Arrow Counterclockwise',
		defaultWidth: 150,
		defaultHeight: 150,
		geometry: {
			kind: 'path',
			fillRule: 'evenodd',
			d: 'M50,1 C78,2 99,23 99,50 C99,77 77,99 50,99 C23,99 1,77 1,50 C1,39 6,29 14,21 L1,12 L28,1 L26,24 C20,31 17,40 17,50 C17,68 32,83 50,83 C68,83 83,68 83,50 C83,32 69,18 50,17 Z'
		}
	}
] as const satisfies readonly AdditionalArrowDefinition[];

export type AdditionalArrowId = (typeof ADDITIONAL_ARROW_DEFINITIONS)[number]['id'];

export const ADDITIONAL_ARROW_DEFINITION_BY_ID = Object.fromEntries(
	ADDITIONAL_ARROW_DEFINITIONS.map((definition) => [definition.id, definition])
) as Record<AdditionalArrowId, (typeof ADDITIONAL_ARROW_DEFINITIONS)[number]>;

export const ADDITIONAL_ARROW_VARIANTS = Object.fromEntries(
	ADDITIONAL_ARROW_DEFINITIONS.map(({ id }) => [id, { kind: 'svg' as const }])
) as Record<AdditionalArrowId, { kind: 'svg' }>;

export const ADDITIONAL_ARROW_GEOMETRY = Object.fromEntries(
	ADDITIONAL_ARROW_DEFINITIONS.map(({ id, geometry }) => [id, geometry])
) as Record<AdditionalArrowId, AdditionalArrowGeometry>;
