import type { ConnectionEdgeData, MarkerKind } from '../../../edges/types';
import type { NodeShape } from '../../types';

/** ER markers that can be combined into a cardinality connection preset. */
export type CardinalityMarker = Extract<
	MarkerKind,
	'bar' | 'bar-double' | 'crowfoot' | 'circle-crowfoot' | 'bar-crowfoot' | 'circle-bar'
>;

export interface CardinalityPresetConfig {
	id: string;
	label: string;
	icon: NodeShape['icon'];
	markerStart?: CardinalityMarker;
	markerEnd: CardinalityMarker;
}

/**
 * Creates an ER connection preset with the same stable orthogonal footprint
 * as the original Entity Relation connections.
 */
export function createCardinalityPreset({
	id,
	label,
	icon,
	markerStart,
	markerEnd
}: CardinalityPresetConfig): NodeShape {
	return {
		id,
		label,
		category: 'entity-relation',
		icon,
		defaultData: () => ({}),
		edgePreset: (center) => {
			const data: ConnectionEdgeData = {
				bendPoints: [
					{ x: center.x - 35, y: center.y + 70 },
					{ x: center.x - 35, y: center.y - 70 }
				],
				markerEnd,
				lineCap: 'butt'
			};

			if (markerStart) data.markerStart = markerStart;

			return {
				source: { x: center.x - 80, y: center.y + 70 },
				target: { x: center.x + 80, y: center.y - 70 },
				data
			};
		}
	};
}
