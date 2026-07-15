import type { NodeShape } from '../../types';
import Icon from './icon.svelte';

/**
 * One-to-Many cardinality — a connection preset whose end marker combines
 * the mandatory-one bar with a crow's foot. It uses the same free-floating
 * anchors and rigid-move behaviour as the Zero-to-Many preset.
 */
export const oneToManyShape: NodeShape = {
	id: 'OneToManyConnection',
	label: '1 to Many',
	category: 'entity-relation',
	icon: Icon,
	defaultData: () => ({}),
	edgePreset: (center) => ({
		source: { x: center.x - 80, y: center.y + 70 },
		target: { x: center.x + 80, y: center.y - 70 },
		data: {
			bendPoints: [
				{ x: center.x - 35, y: center.y + 70 },
				{ x: center.x - 35, y: center.y - 70 }
			],
			markerEnd: 'bar-crowfoot',
			lineCap: 'butt'
		}
	})
};
