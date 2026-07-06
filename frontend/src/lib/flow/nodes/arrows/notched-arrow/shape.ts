import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const notchedArrowShape: NodeShape = {
	id: 'NotchedArrowNode',
	label: 'Notched Arrow',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 180,
	defaultHeight: 100,
	defaultData: () => ({
		label: 'Notched Arrow'
	})
};
