import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const diamondShape: NodeShape = {
    id: 'DiamondNode',
    label: 'Diamond',
    category: 'basic',
    component: Component,
    icon: Icon,
    defaultData: () => ({
        label: 'Decision'
    })
};
