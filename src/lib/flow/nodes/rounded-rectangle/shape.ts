import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const roundedRectangleShape: NodeShape = {
	id: 'RoundedRectangleNode',
	label: 'Rounded Rectangle',
	category: 'basic',
	component: Component,
	icon: Icon,
	defaultData: () => ({
		label: 'Rounded'
	})
};
