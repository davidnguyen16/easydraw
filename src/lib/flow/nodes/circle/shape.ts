import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const circleShape: NodeShape = {
    id: 'CircleNode',
    label: 'Circle',
    category: 'basic',
    component: Component,
    icon: Icon,
    defaultData: () => ({
        label: 'Circle'
    })
};
