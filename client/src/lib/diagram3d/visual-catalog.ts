import { SHAPE_GEOMETRY, VARIANTS, type ShapeGeometry } from '../flow/nodes/shape-geometry';

export type VisualKind = 'svg' | 'sphere' | 'cylinder' | 'cube' | 'actor' | 'text' | 'image' | 'vector-artwork' | 'flat-artwork' | 'fallback';
export interface NodeVisualDefinition {
  kind: VisualKind;
  /** Only generated from our trusted, local geometry catalog; never imported SVG. */
  svg?: string;
  viewBox?: [number, number, number, number];
  marks?: { x: number; y: number; text: string; fontSize: number }[];
}

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const stroke = 'stroke="#2c2c2a" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" data-stroke="ink"';
const filled = `fill="#ffffff" data-fill="surface" ${stroke}`;
const open = `fill="none" ${stroke}`;
const rect = (radius = 0) => `<rect x="1" y="1" width="98" height="98" rx="${radius}" ${filled}/>`;

function geometrySVG(geometry: ShapeGeometry): string {
  switch (geometry.kind) {
    case 'ellipse': return `<ellipse cx="50" cy="50" rx="49" ry="49" ${filled}/>`;
    case 'polygon': return `<polygon points="${geometry.points}" ${filled}/>`;
    case 'polygons': return geometry.items.map((points) => `<polygon points="${points}" ${filled}/>`).join('');
    case 'path': return `<path d="${geometry.d}" fill-rule="${geometry.fillRule ?? 'nonzero'}" ${filled}/>`;
    case 'paths': return geometry.items.map((item) => `<path d="${item.d}" ${item.filled === false ? open : filled}${item.dash ? ` stroke-dasharray="${item.dash}"` : ''}/>`).join('');
    case 'bullseye': return `<circle cx="50" cy="50" r="49" ${filled}/><circle cx="50" cy="50" r="31" fill="#2c2c2a" data-fill="ink" stroke="none"/>`;
    case 'actor': return '';
  }
}

/** Every 2D catalog entry has a visual recipe; geometry aliases remain aliases. */
export const SUPPORTED_3D_NODE_TYPES: readonly string[] = Object.freeze([
  ...Object.keys(VARIANTS),
  'EntityNode', 'WeakEntityNode', 'CustomImageNode', 'VectorPathNode', 'SourceImageNode', 'group',
]);

export function getNodeVisualDefinition(type: string, data: Record<string, unknown> = {}): NodeVisualDefinition {
  if (type === 'VectorPathNode') return { kind: 'vector-artwork' };
  if (type === 'SourceImageNode') return { kind: 'flat-artwork' };
  if (type === 'CustomImageNode') return { kind: 'image' };
  if (type === 'TextNode') return { kind: 'text' };
  if (type === 'ActorNode') return { kind: 'actor' };
  if (type === 'DatabaseNode') return { kind: 'cylinder' };
  if (type === 'CubeNode' || type === 'UmlDeploymentNode') return { kind: 'cube' };
  if (type === 'CircleNode' || type === 'EllipseNode' || type === 'UmlInitialNode') return { kind: 'sphere' };
  if (type === 'EntityNode' || type === 'WeakEntityNode') {
    const weak = type === 'WeakEntityNode' || data.weak === true;
    return { kind: 'svg', svg: svg(`${rect(data.rounded === false ? 0 : 3)}
      ${weak ? `<rect x="5" y="5" width="90" height="90" ${open}/>` : ''}`) };
  }
  if (type === 'group') return { kind: 'svg', svg: svg(rect(3)) };
  const variant = VARIANTS[type];
  if (!variant) return { kind: 'fallback' };
  if (variant.kind === 'boxed') {
    const shape = variant.geometry ?? type;
    const radius = shape === 'RectangleNode' && data.rounded !== true ? 0
      : variant.boxRadius === '9999px' ? 49 : Number.parseFloat(variant.boxRadius ?? '0');
    return { kind: 'svg', svg: svg(rect(Math.min(49, radius))) };
  }
  const geometry = SHAPE_GEOMETRY[variant.geometry ?? type];
  return geometry ? { kind: 'svg', svg: svg(geometrySVG(geometry)) } : { kind: 'fallback' };
}
