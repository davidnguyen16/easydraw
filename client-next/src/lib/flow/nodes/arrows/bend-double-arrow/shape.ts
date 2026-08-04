import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const bendDoubleArrowShape: NodeShape = {
	id: 'BendDoubleArrowNode',
	label: 'Bend Double Arrow',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 140,
	defaultHeight: 140,
	defaultData: () => ({
		label: ''
	})
};
