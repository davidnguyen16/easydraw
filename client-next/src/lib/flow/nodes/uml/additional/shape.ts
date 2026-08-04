import type { NodeShape } from '../../types';
import Component from '../../ShapeNode';
import ActivationIcon from './activation-icon';
import ActivityPartitionIcon from './activity-partition-icon';
import ActionActivityIcon from './action-activity-icon';
import ArtifactIcon from './artifact-icon';
import CombinedFragmentIcon from './combined-fragment-icon';
import ComponentIcon from './component-icon';
import ConstraintIcon from './constraint-icon';
import DecisionMergeIcon from './decision-merge-icon';
import DeploymentNodeIcon from './deployment-node-icon';
import FinalNodeIcon from './final-node-icon';
import ForkJoinIcon from './fork-join-icon';
import InitialNodeIcon from './initial-node-icon';
import LifelineIcon from './lifeline-icon';
import NoteCommentIcon from './note-comment-icon';
import PackageIcon from './package-icon';
import PortIcon from './port-icon';
import StateIcon from './state-icon';
import SystemBoundaryIcon from './system-boundary-icon';
import UseCaseIcon from './use-case-icon';
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
