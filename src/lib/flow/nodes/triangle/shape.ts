import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const triangleShape: NodeShape = {
    id: 'TriangleNode',
    label: 'Triangle',
    category: 'basic',
    component: Component,
    icon: Icon,
    defaultData: () => ({
        label: 'Triangle'
    })
};
