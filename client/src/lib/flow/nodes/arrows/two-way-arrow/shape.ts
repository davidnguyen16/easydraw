import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const twoWayArrowShape: NodeShape = {
	id: 'TwoWayArrowNode',
	label: 'Two Way Arrow',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 200,
	defaultHeight: 100,
	defaultData: () => ({
		label: ''
	})
};
