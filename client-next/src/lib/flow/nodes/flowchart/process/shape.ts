import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

// Rectangle geometry reused under the flowchart name (see VARIANTS'
// `geometry` alias in ShapeNode.svelte).
export const processShape: NodeShape = {
	id: 'ProcessNode',
	label: 'Process',
	category: 'flowchart',
	component: Component,
	icon: Icon,
	defaultWidth: 180,
	defaultHeight: 100,
	defaultData: () => ({
		label: 'Process'
	})
};
