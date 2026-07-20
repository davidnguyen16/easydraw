import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

// Parallelogram geometry reused under the flowchart name (input/output).
export const dataShape: NodeShape = {
	id: 'DataNode',
	label: 'Input / Output',
	category: 'flowchart',
	component: Component,
	icon: Icon,
	defaultWidth: 170,
	defaultHeight: 90,
	defaultData: () => ({
		label: 'Data'
	})
};
