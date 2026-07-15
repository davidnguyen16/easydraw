import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const pentagonShape: NodeShape = {
	id: 'PentagonNode',
	label: 'Pentagon',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Near-square box keeps the point-up pentagon looking regular.
	defaultWidth: 130,
	defaultHeight: 125,
	defaultData: () => ({
		label: ''
	})
};
