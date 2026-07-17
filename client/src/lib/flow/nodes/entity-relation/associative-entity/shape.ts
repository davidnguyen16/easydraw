import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

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
