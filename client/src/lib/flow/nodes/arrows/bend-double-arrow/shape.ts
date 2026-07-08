import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const bendDoubleArrowShape: NodeShape = {
	id: 'BendDoubleArrowNode',
	label: 'Bend Double Arrow',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 140,
	defaultHeight: 140,
	defaultData: () => ({
		label: 'Bend Double Arrow'
	})
};
