import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const cubeShape: NodeShape = {
    id: 'CubeNode',
    label: 'Cube',
    category: 'basic',
    component: Component,
    icon: Icon,
    // Drop with a near-square box matching the cube's viewBox proportions
    // (~96×93 effective area inside the 100×100 viewBox). 130×120 keeps the
    // 3D perspective from looking either pinched or stretched.
    defaultWidth: 130,
    defaultHeight: 120,
    defaultData: () => ({
        label: 'Node'
    })
};
