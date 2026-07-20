import type { NodeShape } from '../types';
import { NETWORK_DEFINITIONS } from './definitions';
import NetworkNode from './NetworkNode.svelte';
import NetworkPaletteIcon from './NetworkPaletteIcon.svelte';

/** Network device and visual-boundary palette entries, generated from one catalog. */
export const networkShapes: readonly NodeShape[] = NETWORK_DEFINITIONS.map((definition) => ({
	id: definition.id,
	label: definition.label,
	category: 'network',
	paletteGroup: definition.paletteGroup,
	searchAliases: definition.searchAliases,
	component: NetworkNode,
	icon: NetworkPaletteIcon,
	paletteIconProps: { id: definition.id },
	defaultWidth: definition.defaultWidth,
	defaultHeight: definition.defaultHeight,
	// Svelte Flow elevates a selected node by 1000. A deeper base layer keeps
	// visual zones behind real devices even while their resize frame is active.
	defaultZIndex: definition.kind === 'container' ? -2000 : undefined,
	defaultData: () => ({
		label: definition.label,
		accentColor: '#a6192e',
		...(definition.kind === 'container' ? { textAlign: 'left' } : {})
	})
}));
