import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const ellipseShape: NodeShape = {
    id: 'EllipseNode',
    label: 'Ellipse',
    category: 'basic',
    component: Component,
    icon: Icon,
    defaultData: () => ({
        label: 'Ellipse'
    })
};
