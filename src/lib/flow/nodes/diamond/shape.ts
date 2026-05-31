import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const diamondShape: NodeShape = {
    id: 'DiamondNode',
    label: 'Diamond',
    category: 'basic',
    component: Component,
    icon: Icon,
    // Drop with a square box (1:1) so the diamond is perfectly symmetric at
    // rest. Without an explicit size xyflow's content-driven default yields
    // a wider-than-tall box and the diamond looks squashed.
    defaultWidth: 120,
    defaultHeight: 120,
    defaultData: () => ({
        label: 'Decision'
    })
};
