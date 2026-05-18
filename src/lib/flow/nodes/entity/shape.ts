import type { NodeShape } from '../types';
import Component from './component.svelte';
import FieldsPanel from './FieldsPanel.svelte';
import Icon from './icon.svelte';

export const entityShape: NodeShape = {
    id: 'EntityNode',
    label: 'Entity',
    category: 'database',
    component: Component,
    icon: Icon,
    defaultData: () => ({
        label: 'Entity',
        fields: [{ name: 'field' }, { name: 'field' }, { name: 'field' }]
    }),
    panel: {
        label: 'Fields',
        component: FieldsPanel
    }
};
