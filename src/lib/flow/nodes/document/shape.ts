import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const documentShape: NodeShape = {
    id: 'DocumentNode',
    label: 'Document',
    category: 'basic',
    component: Component,
    icon: Icon,
    defaultData: () => ({
        label: 'Document'
    })
};
