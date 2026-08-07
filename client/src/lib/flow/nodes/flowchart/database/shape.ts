import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const databaseShape: NodeShape = {
	id: 'DatabaseNode',
	label: 'Database',
	category: 'flowchart',
	component: Component,
	icon: Icon,
	// Portrait cylinder (ratio ≈ 0.83) so a fresh drop reads as a database,
	// not a squat drum.
	defaultWidth: 150,
	defaultHeight: 180,
	defaultData: () => ({
		label: 'Database'
	})
};
