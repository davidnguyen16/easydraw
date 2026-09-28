export type {
  DiagramCamera3D as DiagramCamera,
  DiagramView3D,
} from '@easydraw/diagram-schema';

export type DiagramViewMode = '2d' | '3d';

import type { Vec3 } from './scene-model';
import type { PaletteDragPayload } from '@/lib/flow/dnd';

export type Diagram3DTool = 'select' | 'move' | 'rotate' | 'scale' | 'connect' | 'orbit';
export type EditPhase = 'start' | 'update' | 'end';
export interface NodeTransform3D {
  position?: Vec3;
  size?: Vec3;
  rotation?: Vec3;
}
export interface DiagramSceneEditing {
  tool: Diagram3DTool;
  disabled: boolean;
  snapToGrid: boolean;
  showGrid: boolean;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  onSelectNode: (id: string, additive: boolean) => void;
  onSelectEdge: (id: string, additive: boolean) => void;
  onClearSelection: () => void;
  onTransformNode: (id: string, patch: NodeTransform3D, phase: EditPhase) => void;
  onConnect: (sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string) => void;
  onDropShape: (shapeId: PaletteDragPayload, position: Vec3) => void;
  onEditNodeLabel: (id: string, label: string) => void;
  onEditEdgeLabel: (edgeId: string, labelId: string | undefined, text: string) => void;
  onMoveEdgePoint: (edgeId: string, index: number, point: Vec3, phase: EditPhase) => void;
  onMoveEdgeEndpoint?: (edgeId: string, end: 'source' | 'target', point: Vec3, phase: EditPhase) => void;
  onReconnect?: (edgeId: string, end: 'source' | 'target', nodeId: string, handleId?: string) => void;
  onContextMenu?: (kind: 'node' | 'edge', id: string, x: number, y: number) => void;
}
