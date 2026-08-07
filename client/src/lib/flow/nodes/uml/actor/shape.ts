import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const actorShape: NodeShape = {
	id: 'ActorNode',
	label: 'Actor',
	category: 'uml',
	component: Component,
	icon: Icon,
	// Drop with a tall narrow box (2:3) so the stick figure reads as a
	// person, not a squashed square. The 100×100 viewBox does mean the
	// head squishes slightly into an oval at this ratio — acceptable for
	// a stick figure; users who want a perfectly round head can resize
	// back to a square box afterwards.
	defaultWidth: 80,
	defaultHeight: 120,
	defaultData: () => ({
		label: 'Actor'
	})
};
