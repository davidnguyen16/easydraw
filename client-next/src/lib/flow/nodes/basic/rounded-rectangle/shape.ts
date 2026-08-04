import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const roundedRectangleShape: NodeShape = {
	id: 'RoundedRectangleNode',
	label: 'Rounded Rectangle',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Drop at the same fixed box as Rectangle so both basic boxes match.
	defaultWidth: 180,
	defaultHeight: 100,
	defaultData: () => ({
		label: ''
	})
};
