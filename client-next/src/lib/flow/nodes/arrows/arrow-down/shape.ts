import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const arrowDownShape: NodeShape = {
	id: 'ArrowDownNode',
	label: 'Arrow Down',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 100,
	defaultHeight: 150,
	defaultData: () => ({
		label: ''
	})
};
