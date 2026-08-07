import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const textShape: NodeShape = {
	id: 'TextNode',
	label: 'Text',
	category: 'basic',
	component: Component,
	icon: Icon,
	defaultData: () => ({
		label: ''
	})
};
