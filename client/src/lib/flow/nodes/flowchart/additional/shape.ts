import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import { ADDITIONAL_FLOWCHART_DEFINITIONS } from './definitions';
import PredefinedProcessIcon from './predefined-process-icon.svelte';
import MultipleDocumentsIcon from './multiple-documents-icon.svelte';
import ManualInputIcon from './manual-input-icon.svelte';
import ManualOperationIcon from './manual-operation-icon.svelte';
import PreparationIcon from './preparation-icon.svelte';
import InternalStorageIcon from './internal-storage-icon.svelte';
import StoredDataIcon from './stored-data-icon.svelte';
import DisplayIcon from './display-icon.svelte';
import DelayIcon from './delay-icon.svelte';
import OnPageConnectorIcon from './on-page-connector-icon.svelte';
import OffPageConnectorIcon from './off-page-connector-icon.svelte';
import SortIcon from './sort-icon.svelte';
import MergeIcon from './merge-icon.svelte';
import AnnotationIcon from './annotation-icon.svelte';

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
