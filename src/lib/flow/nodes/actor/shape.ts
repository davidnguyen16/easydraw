import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const actorShape: NodeShape = {
    id: 'ActorNode',
    label: 'Actor',
    category: 'basic',
    component: Component,
    icon: Icon,
    defaultData: () => ({
        label: 'Actor'
    })
};
