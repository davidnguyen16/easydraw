import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const trapezoidShape: NodeShape = {
	id: 'TrapezoidNode',
	label: 'Trapezoid',
	category: 'basic',
	component: Component,
	icon: Icon,
	defaultWidth: 180,
	defaultHeight: 100,
	defaultData: () => ({
		label: 'Trapezoid'
	})
};
