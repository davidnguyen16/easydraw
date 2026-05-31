import type { NodeShape } from '../types';
import Component from '../shared/ShapeNode.svelte';
import Icon from './icon.svelte';

export const triangleShape: NodeShape = {
    id: 'TriangleNode',
    label: 'Triangle',
    category: 'basic',
    component: Component,
    icon: Icon,
    // Drop with a ~1.17:1 box close to equilateral proportions (140×120).
    // The SVG polygon is isosceles (mirrored around x=50) regardless of the
    // bounding box, but a near-square box keeps both slanted sides visually
    // balanced and stops the drop from looking like a stretched arrow.
    defaultWidth: 140,
    defaultHeight: 120,
    defaultData: () => ({
        label: 'Triangle'
    })
};
