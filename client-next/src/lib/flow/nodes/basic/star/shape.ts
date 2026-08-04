import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const starShape: NodeShape = {
	id: 'StarNode',
	label: 'Star',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Near-square box keeps the five points even.
	defaultWidth: 130,
	defaultHeight: 125,
	defaultData: () => ({
		label: ''
	})
};
