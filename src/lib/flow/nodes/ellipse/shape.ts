import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const ellipseShape: NodeShape = {
	id: 'EllipseNode',
	label: 'Ellipse',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Drop with a ~1.8:1 wide box so the shape is visibly elliptical (not
	// accidentally circular) at rest. Resizing afterwards is unconstrained.
	defaultWidth: 180,
	defaultHeight: 100,
	defaultData: () => ({
		label: 'Ellipse'
	})
};
