import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const pillShape: NodeShape = {
	id: 'PillNode',
	label: 'Pill',
	category: 'basic',
	component: Component,
	icon: Icon,
	defaultData: () => ({
		label: 'Start'
	})
};
