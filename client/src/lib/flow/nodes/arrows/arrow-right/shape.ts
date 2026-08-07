import type { NodeShape } from '../../types';
import Components from '../../ShapeNode';
import Icon from './icon';

export const arrowRightShape: NodeShape = {
	id: 'ArrowRightNode',
	label: 'Arrow Right',
	category: 'arrows',
	component: Components,
	icon: Icon,
	defaultWidth: 150,
	defaultHeight: 100,
	defaultData: () => ({
		label: ''
	})
};
