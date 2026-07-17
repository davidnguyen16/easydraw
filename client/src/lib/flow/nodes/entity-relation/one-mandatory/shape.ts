import type { NodeShape } from '../../types';
import Icon from './icon.svelte';

/** One-and-only-one (mandatory) cardinality at the target end. */
export const oneMandatoryShape: NodeShape = {
	id: 'OneMandatoryConnection',
	label: '1 Mandatory',
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
			markerEnd: 'bar-double',
			lineCap: 'butt'
		}
	})
};
