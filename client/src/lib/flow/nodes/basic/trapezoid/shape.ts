import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const trapezoidShape: NodeShape = {
	id: 'TrapezoidNode',
	label: 'Trapezoid',
	category: 'basic',
	component: Component,
	icon: Icon,
	defaultWidth: 180,
	defaultHeight: 100,
	defaultData: () => ({
		label: ''
	})
};
