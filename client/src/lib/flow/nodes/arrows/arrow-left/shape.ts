import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const arrowLeftShape: NodeShape = {
	id: 'ArrowLeftNode',
	label: 'Arrow Left',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 150,
	defaultHeight: 100,
	defaultData: () => ({
		label: ''
	})
};
