import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

// Same boxed geometry as Rectangle — identity comes from the 1:1 drop box.
export const squareShape: NodeShape = {
	id: 'SquareNode',
	label: 'Square',
	category: 'basic',
	component: Component,
	icon: Icon,
	defaultWidth: 120,
	defaultHeight: 120,
	defaultData: () => ({
		label: ''
	})
};
