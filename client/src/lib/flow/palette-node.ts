import type { Node, XYPosition } from '@xyflow/react';
import { cloneVisual3DRecipe, isVisual3DRecipe } from '@easydraw/diagram-schema';
import type { PaletteDragPayload } from './dnd';
import { getShape } from './nodes/registry';

/** One snapshot constructor for the 2D and 3D palettes. Never stores signed URLs. */
export function createPaletteNode(payload: PaletteDragPayload, position: XYPosition, id: string): Node | null {
  if (typeof payload !== 'string' && payload.kind === 'object-3d') {
    if (!isVisual3DRecipe(payload.recipe)) return null;
    const { size, fill, ...recipe } = cloneVisual3DRecipe(payload.recipe);
    const width = size?.width ?? 120;
    const height = size?.height ?? 120;
    return {
      id,
      type: 'CubeNode',
      position: { ...position },
      width,
      height,
      style: { width, height },
      selected: true,
      data: {
        label: payload.name,
        fillColor: fill ?? '#ffffff',
        shadow: true,
        visual3d: recipe,
        ...(size ? { spatial3d: { depth: size.depth } } : {}),
      },
    };
  }
  if (typeof payload !== 'string') {
    if (payload.kind !== 'custom-node' || !payload.assetId || !payload.definitionId) return null;
    const dimensions = [payload.intrinsicWidth, payload.intrinsicHeight, payload.defaultWidth, payload.defaultHeight];
    if (dimensions.some((size) => !Number.isFinite(size) || size <= 0)) return null;
    return {
      id,
      type: 'CustomImageNode',
      position: { ...position },
      width: payload.defaultWidth,
      height: payload.defaultHeight,
      selected: true,
      data: {
        definitionId: payload.definitionId,
        assetId: payload.assetId,
        label: payload.label,
        intrinsicWidth: payload.intrinsicWidth,
        intrinsicHeight: payload.intrinsicHeight,
        fit: 'contain',
      },
    };
  }
  const shape = getShape(payload);
  if (!shape || shape.edgePreset) return null;
  return {
    id,
    type: shape.id,
    position: { ...position },
    data: shape.defaultData(),
    selected: true,
    ...(shape.defaultWidth ? { width: shape.defaultWidth } : {}),
    ...(shape.defaultHeight ? { height: shape.defaultHeight } : {}),
    ...(shape.defaultZIndex !== undefined ? { zIndex: shape.defaultZIndex } : {}),
  };
}
