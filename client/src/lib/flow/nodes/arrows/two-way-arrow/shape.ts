import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const twoWayArrowShape: NodeShape = {
	id: 'TwoWayArrowNode',
	label: 'Two Way Arrow',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 200,
	defaultHeight: 100,
	defaultData: () => ({
		label: ''
	})
};
