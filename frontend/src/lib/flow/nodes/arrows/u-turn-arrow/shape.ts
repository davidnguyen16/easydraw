import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const uTurnArrowShape: NodeShape = {
	id: 'UTurnArrowNode',
	label: 'U-Turn Arrow',
	category: 'arrows',
	component: Component,
	icon: Icon,
	defaultWidth: 140,
	defaultHeight: 140,
	defaultData: () => ({
		label: 'U-Turn Arrow'
	})
};
