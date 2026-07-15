import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

// 1:1 box like Circle so the ring drops round.
export const donutShape: NodeShape = {
	id: 'DonutNode',
	label: 'Donut',
	category: 'basic',
	component: Component,
	icon: Icon,
	defaultWidth: 140,
	defaultHeight: 140,
	defaultData: () => ({
		label: ''
	})
};
