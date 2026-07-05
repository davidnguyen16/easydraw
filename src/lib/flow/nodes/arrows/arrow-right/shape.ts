import type { NodeShape } from '../../types';
import Components from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const arrowRightShape: NodeShape = {
    id: 'ArrowRightNode',
    label: 'Arrow Right',
    category: 'arrows',
    component: Components,
    icon: Icon,
    defaultWidth: 150,
    defaultHeight: 100,
    defaultData: () => ({
        label: 'Arrow Right'
    })
};
