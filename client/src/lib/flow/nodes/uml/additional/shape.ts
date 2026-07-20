import type { NodeShape } from '../../types';
import Component from '../../ShapeNode.svelte';
import ActivationIcon from './activation-icon.svelte';
import ActivityPartitionIcon from './activity-partition-icon.svelte';
import ActionActivityIcon from './action-activity-icon.svelte';
import ArtifactIcon from './artifact-icon.svelte';
import CombinedFragmentIcon from './combined-fragment-icon.svelte';
import ComponentIcon from './component-icon.svelte';
import ConstraintIcon from './constraint-icon.svelte';
import DecisionMergeIcon from './decision-merge-icon.svelte';
import DeploymentNodeIcon from './deployment-node-icon.svelte';
import FinalNodeIcon from './final-node-icon.svelte';
import ForkJoinIcon from './fork-join-icon.svelte';
import InitialNodeIcon from './initial-node-icon.svelte';
import LifelineIcon from './lifeline-icon.svelte';
import NoteCommentIcon from './note-comment-icon.svelte';
import PackageIcon from './package-icon.svelte';
import PortIcon from './port-icon.svelte';
import StateIcon from './state-icon.svelte';
import SystemBoundaryIcon from './system-boundary-icon.svelte';
import UseCaseIcon from './use-case-icon.svelte';
import { ADDITIONAL_UML_DEFINITIONS, type AdditionalUmlId } from './definitions';

const ICON_BY_ID: Record<AdditionalUmlId, NodeShape['icon']> = {
	UmlPackageNode: PackageIcon,
	UmlComponentNode: ComponentIcon,
	UmlPortNode: PortIcon,
	UmlDeploymentNode: DeploymentNodeIcon,
	UmlArtifactNode: ArtifactIcon,
	UmlNoteCommentNode: NoteCommentIcon,
	UmlConstraintNode: ConstraintIcon,
	UmlUseCaseNode: UseCaseIcon,
	UmlSystemBoundaryNode: SystemBoundaryIcon,
	UmlLifelineNode: LifelineIcon,
	UmlActivationNode: ActivationIcon,
	UmlCombinedFragmentNode: CombinedFragmentIcon,
	UmlActivityPartitionNode: ActivityPartitionIcon,
	UmlActionActivityNode: ActionActivityIcon,
	UmlStateNode: StateIcon,
	UmlInitialNode: InitialNodeIcon,
	UmlFinalNode: FinalNodeIcon,
	UmlDecisionMergeNode: DecisionMergeIcon,
	UmlForkJoinNode: ForkJoinIcon
};

export const additionalUmlShapes: readonly NodeShape[] = ADDITIONAL_UML_DEFINITIONS.map(
	({ id, label, defaultWidth, defaultHeight, defaultData }) => ({
		id,
		label,
		category: 'uml',
		component: Component,
		icon: ICON_BY_ID[id],
		defaultWidth,
		defaultHeight,
		defaultData: () => ({ ...defaultData })
	})
);
