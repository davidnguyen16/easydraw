import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const parallelogramShape: NodeShape = {
    id: 'ParallelogramNode',
    label: 'Parallelogram',
    category: 'basic',
    component: Component,
    icon: Icon,
    // Drop with a 2:1 wide box so the slant is visually clear; without an
    // explicit size xyflow's content-driven default gives a too-narrow box
    // and the parallelogram looks squashed.
    defaultWidth: 200,
    defaultHeight: 100,
    defaultData: () => ({
        label: 'Input / Output'
    })
};
