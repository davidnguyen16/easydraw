import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const notchedArrowShape: NodeShape = {
	id: 'NotchedArrowNode',
	label: 'Notched Arrow',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 180,
	defaultHeight: 100,
	defaultData: () => ({
		label: ''
	})
};
