import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const bendArrowShape: NodeShape = {
	id: 'BendArrowNode',
	label: 'Bend Arrow',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 140,
	defaultHeight: 140,
	defaultData: () => ({
		label: ''
	})
};
