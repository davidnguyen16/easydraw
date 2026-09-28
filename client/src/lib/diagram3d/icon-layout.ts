import type { Visual3DRecipe } from '@easydraw/diagram-schema';
import type { Vec3 } from './scene-model';

/** How an image node presents itself in 3D. */
export type ImageStyle3D = 'puck' | 'plinth' | 'flat';
export const IMAGE_STYLES_3D: { id: ImageStyle3D; label: string }[] = [
  { id: 'puck', label: 'Icon on a round platform' },
  { id: 'plinth', label: 'Icon on a square platform' },
  { id: 'flat', label: 'Flat on the floor' },
];

/** Platform height and the gap under the icon, in world units (1 = 100 px). */
export const PLATFORM_HEIGHT = 0.12;
/** A real object used as a base (a rack, a desk…) keeps its proportions: this tall per unit of footprint. */
const OBJECT_BASE_RATIO = 0.6;
const ICON_GAP = 0.05;
/** The icon spans this much of the platform's width. */
const ICON_SPAN = 0.78;

export function imageStyleOf(data: Record<string, unknown>, base: Visual3DRecipe | null): ImageStyle3D {
  const value = data.imageStyle3d;
  if (value === 'flat' && !base) return 'flat';
  if (value === 'plinth') return 'plinth';
  return 'puck';
}

export interface IconLayout {
  platformSize: Vec3;
  platformCenterY: number;
  imageWidth: number;
  imageHeight: number;
  imageCenterY: number;
  hitWidth: number;
  hitHeight: number;
  hitDepth: number;
  hitCenterY: number;
}

/**
 * Places a platform on the node's footprint and an upright icon above it.
 * Everything is measured from the node's centre, whose box is the thin
 * footprint the scene model assigns to image nodes.
 */
export function iconLayout([width, height, depth]: Vec3, intrinsicWidth: unknown, intrinsicHeight: unknown, base: 'platform' | 'object' = 'platform'): IconLayout {
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const ratio = valid(intrinsicWidth) && valid(intrinsicHeight) ? intrinsicWidth / intrinsicHeight : 1;
  const footprint = Math.max(0.05, Math.min(width, depth));
  const baseHeight = base === 'platform' ? PLATFORM_HEIGHT : footprint * OBJECT_BASE_RATIO;
  const floor = -height / 2;
  const imageWidth = footprint * ICON_SPAN;
  const imageHeight = imageWidth / ratio;
  const imageBottom = floor + baseHeight + ICON_GAP;
  const top = imageBottom + imageHeight;
  return {
    platformSize: [footprint, baseHeight, footprint],
    platformCenterY: floor + baseHeight / 2,
    imageWidth,
    imageHeight,
    imageCenterY: imageBottom + imageHeight / 2,
    hitWidth: Math.max(width, imageWidth),
    hitHeight: top - floor,
    hitDepth: Math.max(depth, imageWidth),
    hitCenterY: floor + (top - floor) / 2,
  };
}
