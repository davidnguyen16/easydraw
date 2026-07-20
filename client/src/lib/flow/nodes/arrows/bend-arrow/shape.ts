import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const bendArrowShape: NodeShape = {
	id: 'BendArrowNode',
	label: 'Bend Arrow',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 140,
	defaultHeight: 140,
	defaultData: () => ({
		label: ''
	})
};
