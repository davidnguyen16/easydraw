import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const circleShape: NodeShape = {
	id: 'CircleNode',
	label: 'Circle',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Drop with a square box so the shape is actually circular at rest.
	// Without this, xyflow's content-driven default gives a wider-than-tall
	// box and the underlying SVG <ellipse> stretches into an oval.
	defaultWidth: 120,
	defaultHeight: 120,
	defaultData: () => ({
		label: ''
	})
};
