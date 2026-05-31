import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const documentShape: NodeShape = {
    id: 'DocumentNode',
    label: 'Document',
    category: 'basic',
    component: Component,
    icon: Icon,
    // Drop with a wider-than-tall box (~1.33:1) so the document reads as a
    // sheet of paper, not a near-square card. Wavy bottom edge stays
    // visually prominent at this ratio.
    defaultWidth: 160,
    defaultHeight: 120,
    defaultData: () => ({
        label: 'Document'
    })
};
