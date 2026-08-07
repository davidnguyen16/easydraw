import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const pentagonShape: NodeShape = {
	id: 'PentagonNode',
	label: 'Pentagon',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Near-square box keeps the point-up pentagon looking regular.
	defaultWidth: 130,
	defaultHeight: 125,
	defaultData: () => ({
		label: ''
	})
};
