import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

// Diamond geometry reused under the flowchart name.
export const decisionShape: NodeShape = {
	id: 'DecisionNode',
	label: 'Decision',
	category: 'flowchart',
	component: Component,
	icon: Icon,
	// Wider than tall — decision diamonds usually hold a question.
	defaultWidth: 160,
	defaultHeight: 110,
	defaultData: () => ({
		label: 'Decision'
	})
};
