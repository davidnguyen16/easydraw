import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const pillShape: NodeShape = {
	id: 'PillNode',
	label: 'Pill',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Retired from the palette, but kept registered so saved diagrams that
	// already contain pill nodes still render.
	hidden: true,
	defaultData: () => ({
		label: ''
	})
};
