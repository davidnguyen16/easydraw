import type { NodeShape } from '../../types';
import Components from '../../ShapeNode';
import CircularClockwiseIcon from './circular-clockwise-icon';
import CircularCounterclockwiseIcon from './circular-counterclockwise-icon';
import CurvedDownIcon from './curved-down-icon';
import CurvedLeftIcon from './curved-left-icon';
import CurvedRightIcon from './curved-right-icon';
import CurvedUpIcon from './curved-up-icon';
import MergeIcon from './merge-icon';
import SplitIcon from './split-icon';
import ThreeWayIcon from './three-way-icon';
import UpDownIcon from './up-down-icon';
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
