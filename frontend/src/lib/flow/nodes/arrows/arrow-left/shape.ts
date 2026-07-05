import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const arrowLeftShape: NodeShape = {
    id: 'ArrowLeftNode',
    label: 'Arrow Left',
    category: 'arrows',
    component: Component,
    icon: Icon,
    defaultWidth: 150,
    defaultHeight: 100,
    defaultData: () => ({
        label: 'Arrow Left'
    })
};