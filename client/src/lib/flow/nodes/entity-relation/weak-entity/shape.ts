import type { NodeShape } from '../../types';
import Component from '../entity/component.svelte';
import { createEntityDefaultData, entityFieldsPanel } from '../entity/shape';
import Icon from './icon.svelte';

export const weakEntityShape: NodeShape = {
	id: 'WeakEntityNode',
	label: 'Weak Entity',
	category: 'entity-relation',
	component: Component,
	icon: Icon,
	defaultData: () => createEntityDefaultData('Weak Entity', true),
	panel: entityFieldsPanel
};
