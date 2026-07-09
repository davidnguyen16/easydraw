import type { NodeShape } from '../../types';
import Component from './component.svelte';
import FieldsPanel from './FieldsPanel.svelte';
import Icon from './icon.svelte';

export function createEntityDefaultData(label = 'Entity', weak = false): Record<string, unknown> {
	return {
		label,
		weak,
		fields: [{ name: 'field' }, { name: 'field' }, { name: 'field' }]
	};
}

export const entityFieldsPanel = {
	label: 'Fields',
	component: FieldsPanel
};

export const entityShape: NodeShape = {
	id: 'EntityNode',
	label: 'Entity',
	category: 'entity-relation',
	component: Component,
	icon: Icon,
	defaultData: () => createEntityDefaultData(),
	panel: entityFieldsPanel
};
