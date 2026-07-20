import type { NodeShape } from '../../types';
import Components from '../../ShapeNode.svelte';
import CircularClockwiseIcon from './circular-clockwise-icon.svelte';
import CircularCounterclockwiseIcon from './circular-counterclockwise-icon.svelte';
import CurvedDownIcon from './curved-down-icon.svelte';
import CurvedLeftIcon from './curved-left-icon.svelte';
import CurvedRightIcon from './curved-right-icon.svelte';
import CurvedUpIcon from './curved-up-icon.svelte';
import MergeIcon from './merge-icon.svelte';
import SplitIcon from './split-icon.svelte';
import ThreeWayIcon from './three-way-icon.svelte';
import UpDownIcon from './up-down-icon.svelte';
import { ADDITIONAL_ARROW_DEFINITIONS, type AdditionalArrowId } from './definitions';

const ICON_BY_ID: Record<AdditionalArrowId, NodeShape['icon']> = {
	UpDownArrowNode: UpDownIcon,
	ThreeWayArrowNode: ThreeWayIcon,
	SplitArrowNode: SplitIcon,
	MergeArrowNode: MergeIcon,
	CurvedRightArrowNode: CurvedRightIcon,
	CurvedLeftArrowNode: CurvedLeftIcon,
	CurvedUpArrowNode: CurvedUpIcon,
	CurvedDownArrowNode: CurvedDownIcon,
	CircularArrowClockwiseNode: CircularClockwiseIcon,
	CircularArrowCounterclockwiseNode: CircularCounterclockwiseIcon
};

export const additionalArrowShapes: readonly NodeShape[] = ADDITIONAL_ARROW_DEFINITIONS.map(
	({ id, label, defaultWidth, defaultHeight }) => ({
		id,
		label,
		category: 'arrows',
		component: Components,
		icon: ICON_BY_ID[id],
		defaultWidth,
		defaultHeight,
		defaultData: () => ({ label: '' })
	})
);
