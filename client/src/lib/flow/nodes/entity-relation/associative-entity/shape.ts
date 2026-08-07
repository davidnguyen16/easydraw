import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const associativeEntityShape: NodeShape = {
	id: 'AssociativeEntityNode',
	label: 'Associative Entity',
	category: 'entity-relation',
	component: Component,
	icon: Icon,
	defaultWidth: 280,
	defaultHeight: 120,
	defaultData: () => ({
		label: 'Associative\nEntity'
	})
};
