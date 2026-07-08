import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

// 1:1 box keeps the four heads symmetric.
export const quadArrowShape: NodeShape = {
	id: 'QuadArrowNode',
	label: 'Quad Arrow',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 150,
	defaultHeight: 150,
	defaultData: () => ({
		label: 'Quad Arrow'
	})
};
