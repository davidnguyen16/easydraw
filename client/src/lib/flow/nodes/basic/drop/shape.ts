import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

// Portrait box so the teardrop reads tall, not squashed.
export const dropShape: NodeShape = {
	id: 'DropNode',
	label: 'Drop',
	category: 'basic',
	component: Component,
	icon: Icon,
	defaultWidth: 120,
	defaultHeight: 150,
	defaultData: () => ({
		label: ''
	})
};
