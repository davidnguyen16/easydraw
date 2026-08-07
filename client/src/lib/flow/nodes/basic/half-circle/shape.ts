import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const halfCircleShape: NodeShape = {
	id: 'HalfCircleNode',
	label: 'Half Circle',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Bottom half (flat top, arc below) — a 2:1-ish box keeps the arc round.
	defaultWidth: 160,
	defaultHeight: 90,
	defaultData: () => ({
		label: ''
	})
};
