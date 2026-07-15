import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const rectangleShape: NodeShape = {
	id: 'RectangleNode',
	label: 'Rectangle',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Drop at a fixed box (instead of auto-sizing tight to the label) so a fresh
	// rectangle has room to type in. Matches the Ellipse's default footprint.
	defaultWidth: 180,
	defaultHeight: 100,
	defaultData: () => ({
		label: ''
	})
};
