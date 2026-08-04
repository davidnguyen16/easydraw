import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const chevronShape: NodeShape = {
	id: 'ChevronNode',
	label: 'Chevron',
	category: 'basic',
	component: Component,
	icon: Icon,
	defaultWidth: 180,
	defaultHeight: 100,
	defaultData: () => ({
		label: ''
	})
};
