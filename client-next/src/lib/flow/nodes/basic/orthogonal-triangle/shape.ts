import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const orthogonalTriangleShape: NodeShape = {
	id: 'OrthogonalTriangleNode',
	label: 'Orthogonal Triangle',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Right angle at the bottom-left; drop square so both legs read equal.
	defaultWidth: 120,
	defaultHeight: 120,
	defaultData: () => ({
		label: ''
	})
};
