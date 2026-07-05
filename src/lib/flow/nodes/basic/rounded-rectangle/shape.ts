import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const roundedRectangleShape: NodeShape = {
	id: 'RoundedRectangleNode',
	label: 'Rounded Rectangle',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Drop at the same fixed box as Rectangle so both basic boxes match.
	defaultWidth: 180,
	defaultHeight: 100,
	defaultData: () => ({
		label: 'Rounded'
	})
};
