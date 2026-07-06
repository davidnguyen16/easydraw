import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const arrowDownShape: NodeShape = {
	id: 'ArrowDownNode',
	label: 'Arrow Down',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 100,
	defaultHeight: 150,
	defaultData: () => ({
		label: 'Arrow Down'
	})
};
