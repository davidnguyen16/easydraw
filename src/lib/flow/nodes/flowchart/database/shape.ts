import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const databaseShape: NodeShape = {
	id: 'DatabaseNode',
	label: 'Database',
	category: 'flowchart',
	component: Component,
	icon: Icon,
	defaultWidth: 150,
	defaultHeight: 100,
	defaultData: () => ({
		label: 'Database'
	})
};
