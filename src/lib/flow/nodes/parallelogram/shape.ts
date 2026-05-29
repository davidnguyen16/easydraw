import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const parallelogramShape: NodeShape = {
    id: 'ParallelogramNode',
    label: 'Parallelogram',
    category: 'basic',
    component: Component,
    icon: Icon,
    defaultData: () => ({
        label: 'Input / Output'
    })
};
