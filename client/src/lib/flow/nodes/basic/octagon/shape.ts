import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const octagonShape: NodeShape = {
	id: 'OctagonNode',
	label: 'Octagon',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Drop as a square box so all eight sides stay even (regular-octagon look).
	defaultWidth: 120,
	defaultHeight: 120,
	defaultData: () => ({
		label: ''
	})
};
