import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const starShape: NodeShape = {
	id: 'StarNode',
	label: 'Star',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Near-square box keeps the five points even.
	defaultWidth: 130,
	defaultHeight: 125,
	defaultData: () => ({
		label: 'Star'
	})
};
