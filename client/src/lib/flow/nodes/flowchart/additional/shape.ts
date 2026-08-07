import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import { ADDITIONAL_FLOWCHART_DEFINITIONS } from './definitions';
import PredefinedProcessIcon from './predefined-process-icon';
import MultipleDocumentsIcon from './multiple-documents-icon';
import ManualInputIcon from './manual-input-icon';
import ManualOperationIcon from './manual-operation-icon';
import PreparationIcon from './preparation-icon';
import InternalStorageIcon from './internal-storage-icon';
import StoredDataIcon from './stored-data-icon';
import DisplayIcon from './display-icon';
import DelayIcon from './delay-icon';
import OnPageConnectorIcon from './on-page-connector-icon';
import OffPageConnectorIcon from './off-page-connector-icon';
import SortIcon from './sort-icon';
import MergeIcon from './merge-icon';
import AnnotationIcon from './annotation-icon';

const ICON_BY_ID: Record<string, NodeShape['icon']> = {
	PredefinedProcessNode: PredefinedProcessIcon,
	MultipleDocumentsNode: MultipleDocumentsIcon,
	ManualInputNode: ManualInputIcon,
	ManualOperationNode: ManualOperationIcon,
	PreparationNode: PreparationIcon,
	InternalStorageNode: InternalStorageIcon,
	StoredDataNode: StoredDataIcon,
	DisplayNode: DisplayIcon,
	DelayNode: DelayIcon,
	OnPageConnectorNode: OnPageConnectorIcon,
	OffPageConnectorNode: OffPageConnectorIcon,
	SortNode: SortIcon,
	MergeNode: MergeIcon,
	AnnotationNode: AnnotationIcon
};

export const additionalFlowchartShapes: readonly NodeShape[] = ADDITIONAL_FLOWCHART_DEFINITIONS.map(
	({ id, label, defaultWidth, defaultHeight }) => ({
		id,
		label,
		category: 'flowchart',
		component: Component,
		icon: ICON_BY_ID[id],
		defaultWidth,
		defaultHeight,
		defaultData: () => ({ label: '' })
	})
);
