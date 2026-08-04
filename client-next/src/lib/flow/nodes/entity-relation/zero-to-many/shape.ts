import type { NodeShape } from '../../types';
import Icon from './icon';

/**
 * Zero-to-Many (optional) cardinality — a CONNECTION preset, not a node.
 * Dropping the tile creates the exact construct you get by detaching both
 * ends of a connection (two floating anchors + one orthogonal `connection`
 * edge), pre-styled with the circle+crow's-foot end marker. It rigid-moves
 * as one object (grab the body) and is styled via ConnectionStylePanel.
 */
export const zeroToManyShape: NodeShape = {
	id: 'ZeroToManyConnection',
	label: '0 to Many Optional',
	category: 'entity-relation',
	icon: Icon,
	defaultData: () => ({}),
	// Drop footprint ~160×140 centred on the cursor. The two bend points pin
	// the draw.io look: short run from the tail, long rise, long run into the
	// marker (source bottom-left, marker end top-right).
	edgePreset: (center) => ({
		source: { x: center.x - 80, y: center.y + 70 },
		target: { x: center.x + 80, y: center.y - 70 },
		data: {
			bendPoints: [
				{ x: center.x - 35, y: center.y + 70 },
				{ x: center.x - 35, y: center.y - 70 },
			],
			markerEnd: 'circle-crowfoot',
			lineCap: 'butt'
		}
	})
};
