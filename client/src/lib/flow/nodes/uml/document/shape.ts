import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import Icon from './icon.svelte';

export const documentShape: NodeShape = {
	id: 'DocumentNode',
	label: 'Document',
	// Flowchart Document symbol (rect + wavy bottom). Lives in this uml/ folder
	// for history, but belongs to the flowchart sidebar section.
	category: 'flowchart',
	component: Component,
	icon: Icon,
	// Drop at the same footprint as the Rectangle (180×100) so basic shapes
	// share a consistent default size. The wavy bottom edge still reads clearly
	// at this ratio.
	defaultWidth: 180,
	defaultHeight: 100,
	defaultData: () => ({
		label: 'Document'
	})
};
