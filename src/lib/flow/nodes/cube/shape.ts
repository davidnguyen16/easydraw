import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const cubeShape: NodeShape = {
    id: 'CubeNode',
    label: 'Cube',
    category: 'basic',
    component: Component,
    icon: Icon,
    defaultData: () => ({
        label: 'Node'
    })
};
