import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const cubeShape: NodeShape = {
	id: 'CubeNode',
	label: 'Cube',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Drop with a near-square box matching the cube's viewBox proportions (the
	// hexagon silhouette now fills the 100×100 viewBox). 165×165 keeps the 3D
	// perspective from looking either pinched or stretched.
	defaultWidth: 165,
	defaultHeight: 165,
	defaultData: () => ({
		label: ''
	})
};
