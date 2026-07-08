import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const arrowUpShape: NodeShape = {
    id: 'ArrowUpNode',
    label: 'Arrow Up',
    category: 'arrows',
    component: Component,
    icon: Icon,
    defaultWidth: 100,
    defaultHeight: 150,
    defaultData: () => ({
        label: 'Arrow Up'
    })
};