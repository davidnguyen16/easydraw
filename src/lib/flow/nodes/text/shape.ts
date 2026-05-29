import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const textShape: NodeShape = {
    id: 'TextNode',
    label: 'Text',
    category: 'basic',
    component: Component,
    icon: Icon,
    defaultData: () => ({
        label: 'Text'
    })
};
