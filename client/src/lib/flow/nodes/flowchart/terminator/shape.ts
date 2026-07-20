import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

// Ellipse (oval) geometry reused under the flowchart name — start/end block.
export const terminatorShape: NodeShape = {
	id: 'TerminatorNode',
	label: 'Start / End',
	category: 'flowchart',
	component: Component,
	icon: Icon,
	defaultWidth: 160,
	defaultHeight: 70,
	defaultData: () => ({
		label: 'Start'
	})
};
