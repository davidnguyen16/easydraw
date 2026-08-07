import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import Icon from './icon';

export const polygonShape: NodeShape = {
	id: 'PolygonNode',
	label: 'Polygon',
	category: 'basic',
	component: Component,
	icon: Icon,
	// Hexagon with vertical left/right points — drops wider than tall so the
	// side points stay sharp instead of reading as a squashed circle.
	defaultWidth: 160,
	defaultHeight: 100,
	defaultData: () => ({
		label: ''
	})
};
