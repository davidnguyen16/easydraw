import type { NodeShape } from '../../types';
import Icon from './icon.svelte';

/** One-and-only-one cardinality at both ends of the relationship. */
export const oneToOneShape: NodeShape = {
	id: 'OneToOneConnection',
	label: '1 to 1',
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
			markerStart: 'bar-double',
			markerEnd: 'bar-double',
			lineCap: 'butt'
		}
	})
};
