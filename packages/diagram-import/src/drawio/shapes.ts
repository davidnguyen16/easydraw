/**
 * draw.io shape name → EasyDraw node type.
 *
 * The left-hand names are what draw.io writes into `style` (bare token or
 * `shape=`), including its stencil libraries (`mxgraph.flowchart.decision`).
 * Each entry says which EasyDraw shape stands in, whether that is exact or a
 * near match (reported once per kind), and any rotation needed because the
 * two catalogues point their default triangle / arrow in different
 * directions.
 */
import type { DrawioStyle } from './style.js';

export type Fidelity = 'exact' | 'approximate';

export interface ShapeMatch {
  type: string;
  fidelity: Fidelity;
  /** Added to the cell's own rotation so the silhouette faces the same way. */
  rotation?: number;
  /** Sets `rounded` corners on a rectangle-like target. */
  rounded?: boolean;
}

type Direction = 'east' | 'west' | 'north' | 'south';

function directionOf(style: DrawioStyle): Direction {
  const d = style.get('direction');
  return d === 'west' || d === 'north' || d === 'south' ? d : 'east';
}

/** draw.io's default triangle points east; EasyDraw's points north. */
const TRIANGLE_ROTATION: Record<Direction, number> = { north: 0, east: 90, south: 180, west: -90 };
const ARROW_BY_DIRECTION: Record<Direction, string> = {
  east: 'ArrowRightNode', west: 'ArrowLeftNode', north: 'ArrowUpNode', south: 'ArrowDownNode',
};

const exact = (type: string): ShapeMatch => ({ type, fidelity: 'exact' });
const near = (type: string): ShapeMatch => ({ type, fidelity: 'approximate' });

/** Plain names as draw.io writes them into the style string. */
const BASIC: Record<string, ShapeMatch> = {
  '': exact('RectangleNode'),
  rect: exact('RectangleNode'),
  rectangle: exact('RectangleNode'),
  partialRectangle: exact('RectangleNode'),
  label: exact('RectangleNode'),
  text: exact('TextNode'),
  ellipse: exact('EllipseNode'),
  doubleEllipse: exact('UmlFinalNode'),
  rhombus: exact('DiamondNode'),
  hexagon: exact('PolygonNode'),
  parallelogram: exact('ParallelogramNode'),
  trapezoid: exact('TrapezoidNode'),
  cylinder: exact('DatabaseNode'),
  cylinder2: exact('DatabaseNode'),
  cylinder3: exact('DatabaseNode'),
  document: exact('DocumentNode'),
  process: exact('PredefinedProcessNode'),
  dataStorage: exact('StoredDataNode'),
  internalStorage: exact('InternalStorageNode'),
  display: exact('DisplayNode'),
  manualInput: exact('ManualInputNode'),
  offPageConnector: exact('OffPageConnectorNode'),
  delay: exact('DelayNode'),
  note: exact('UmlNoteCommentNode'),
  card: near('RectangleNode'),
  tape: near('RectangleNode'),
  loopLimit: near('PreparationNode'),
  callout: near('RectangleNode'),
  umlActor: exact('ActorNode'),
  actor: exact('ActorNode'),
  umlLifeline: exact('UmlLifelineNode'),
  umlFrame: exact('UmlCombinedFragmentNode'),
  umlState: exact('UmlStateNode'),
  umlControl: near('CircleNode'),
  umlBoundary: near('CircleNode'),
  umlEntity: near('CircleNode'),
  component: exact('UmlComponentNode'),
  module: near('UmlComponentNode'),
  folder: exact('UmlPackageNode'),
  cube: exact('CubeNode'),
  step: exact('ChevronNode'),
  cloud: near('EllipseNode'),
  or: near('HalfCircleNode'),
  xor: near('HalfCircleNode'),
  orEllipse: near('CircleNode'),
  sumEllipse: near('CircleNode'),
  lineEllipse: near('CircleNode'),
  plus: near('RectangleNode'),
  swimlane: near('RectangleNode'),
  table: exact('EntityNode'),
  tableRow: exact('RectangleNode'),
};

/** `mxgraph.<library>.<name>` stencils, keyed by the part after the library. */
const LIBRARIES: Record<string, Record<string, ShapeMatch>> = {
  basic: {
    star: exact('StarNode'), '4_point_star': near('StarNode'), '6_point_star': near('StarNode'), '8_point_star': near('StarNode'),
    octagon: exact('OctagonNode'), pentagon: exact('PentagonNode'), hexagon: exact('PolygonNode'), heptagon: near('OctagonNode'),
    drop: exact('DropNode'), donut: exact('DonutNode'), half_circle: exact('HalfCircleNode'),
    rectangular_callout: near('RectangleNode'), rounded_rectangular_callout: near('RoundedRectangleNode'),
    oval_callout: near('EllipseNode'), cloud_callout: near('EllipseNode'),
    isocTriangle: exact('TriangleNode'), acute_triangle: near('TriangleNode'), obtuse_triangle: near('TriangleNode'),
    rt_triangle: exact('OrthogonalTriangleNode'), diamond: exact('DiamondNode'), pill: exact('PillNode'),
    cube: exact('CubeNode'), banner: near('RectangleNode'), cross: near('RectangleNode'),
  },
  flowchart: {
    decision: exact('DecisionNode'), process: exact('ProcessNode'), terminator: exact('TerminatorNode'),
    document: exact('DocumentNode'), database: exact('DatabaseNode'), data: exact('DataNode'),
    predefined_process: exact('PredefinedProcessNode'), manual_input: exact('ManualInputNode'),
    stored_data: exact('StoredDataNode'), direct_data: exact('DatabaseNode'), display: exact('DisplayNode'),
    delay: exact('DelayNode'), 'off-page_reference': exact('OffPageConnectorNode'),
    'on-page_reference': exact('OnPageConnectorNode'), sort: exact('SortNode'), merge_or_storage: exact('MergeNode'),
    manual_operation: exact('ManualOperationNode'), preparation: exact('PreparationNode'),
    'multi-document': exact('MultipleDocumentsNode'), internal_storage: exact('InternalStorageNode'),
    annotation_1: exact('AnnotationNode'), annotation_2: exact('AnnotationNode'), start_1: exact('TerminatorNode'),
    start_2: exact('CircleNode'), extract_or_measurement: exact('TriangleNode'), or: near('CircleNode'),
    summing_function: near('CircleNode'), collate: near('DiamondNode'), loop_limit: near('PreparationNode'),
    sequential_data: near('CircleNode'), paper_tape: near('RectangleNode'), card: near('RectangleNode'),
    punched_tape: near('RectangleNode'),
  },
  arrows2: {
    arrow: exact('ArrowRightNode'), twoWayArrow: exact('TwoWayArrowNode'), bendArrow: exact('BendArrowNode'),
    bendDoubleArrow: exact('BendDoubleArrowNode'), quadArrow: exact('QuadArrowNode'), uTurnArrow: exact('UTurnArrowNode'),
    stylisedNarrowArrow: near('ArrowRightNode'), threeWayArrow: exact('ThreeWayArrowNode'), splitArrow: near('SplitArrowNode'),
    circularArrow: near('CircularArrowClockwiseNode'), curvedArrow: near('CurvedRightArrowNode'),
  },
  er: { entity: exact('EntityNode'), weakEntity: exact('WeakEntityNode'), relationship: near('DiamondNode') },
  uml: { activity: exact('UmlActionActivityNode'), fork: exact('UmlForkJoinNode'), join: exact('UmlForkJoinNode') },
  sysml: { package: exact('UmlPackageNode') },
};

/** Resolves a style to an EasyDraw node type. `null` means truly unknown. */
export function matchShape(style: DrawioStyle, width: number, height: number): ShapeMatch | null {
  const name = style.shape;

  if (name === 'triangle') {
    return { type: 'TriangleNode', fidelity: 'exact', rotation: TRIANGLE_ROTATION[directionOf(style)] };
  }
  if (name === 'singleArrow' || name === 'flexArrow') {
    return { type: ARROW_BY_DIRECTION[directionOf(style)], fidelity: name === 'flexArrow' ? 'approximate' : 'exact' };
  }
  if (name === 'doubleArrow') {
    const vertical = directionOf(style) === 'north' || directionOf(style) === 'south';
    return exact(vertical ? 'UpDownArrowNode' : 'TwoWayArrowNode');
  }
  if (name === 'ellipse') {
    // draw.io draws circles as ellipses with a locked square aspect.
    const square = Math.abs(width - height) < 1 && (style.get('aspect') === 'fixed' || width <= 80);
    return exact(square ? 'CircleNode' : 'EllipseNode');
  }
  if (name === '' || name === 'rect' || name === 'rectangle' || name === 'label') {
    if (style.on('rounded')) return exact('RoundedRectangleNode');
    return exact(Math.abs(width - height) < 1 ? 'SquareNode' : 'RectangleNode');
  }

  const basic = BASIC[name];
  if (basic) return basic;

  const stencil = name.match(/^mxgraph\.([a-z0-9_]+)\.(.+)$/i);
  if (stencil) {
    const [, library, part] = stencil as [string, string, string];
    const table = LIBRARIES[library];
    if (table) {
      const hit = table[part] ?? table[part.replace(/-/g, '_')];
      if (hit) return hit;
    }
  }
  return null;
}
