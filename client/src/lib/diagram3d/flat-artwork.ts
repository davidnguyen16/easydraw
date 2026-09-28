import { isSourceImageData, isVectorGeometry } from '@easydraw/diagram-schema';
import { resolveVectorAppearance, vectorArrowSize, vectorCommandsInBox } from '../flow/nodes/vector/vector-artwork';
import type { DiagramSceneNode } from './scene-model';

type Point = [number, number];
type Command = { op: 'M' | 'L' | 'Q' | 'C' | 'Z'; values: number[] };
type Appearance = ReturnType<typeof resolveVectorAppearance>;
interface ArtworkBounds {
  width: number;
  height: number;
  padding: number;
  textureWidth: number;
  textureHeight: number;
  opacity: number;
}
export type FlatArtworkPlan = ArtworkBounds & (
  | { kind: 'vector'; commands: Command[]; appearance: Appearance; arrows: Point[][] }
  | { kind: 'image'; image: { dataUrl: string; width: number; height: number; reason: string } }
  | { kind: 'invalid'; error: string }
);

const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Texture budgets apply to the raster backing only; drawing coordinates retain
 * their original size, so stroke width matches the 2D renderer's display pixels. */
function bounds(node: DiagramSceneNode, padding: number): ArtworkBounds {
  const width = Math.max(1, Math.min(100_000, finite(node.size[0] * 100, 100)));
  const height = Math.max(1, Math.min(100_000, finite(node.size[2] * 100, 100)));
  const totalWidth = width + padding * 2, totalHeight = height + padding * 2;
  const scale = Math.min(2, 1024 / Math.max(totalWidth, totalHeight), Math.sqrt(262_144 / (totalWidth * totalHeight)));
  return {
    width, height, padding,
    textureWidth: Math.max(1, Math.floor(totalWidth * scale)),
    textureHeight: Math.max(1, Math.floor(totalHeight * scale)),
    opacity: Math.max(0, Math.min(1, finite(node.data.opacity, 100) / 100)),
  };
}

function different(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-8;
}

/** Endpoint tangents, including repeated curve controls and closed subpaths.
 * Start arrows face away from the first segment; end arrows follow the last. */
export function vectorArrowTriangles(commands: readonly Command[], width: number, start: boolean, end: boolean): Point[][] {
  let cursor: Point = [0, 0], subpath: Point = [0, 0];
  let first: { tip: Point; inner: Point } | undefined;
  let last: { tip: Point; inner: Point } | undefined;
  for (const { op, values } of commands) {
    if (op === 'M') { cursor = [values[0], values[1]]; subpath = cursor; continue; }
    const target: Point = op === 'Z' ? subpath : [values[values.length - 2], values[values.length - 1]];
    const controls: Point[] = op === 'C' ? [[values[0], values[1]], [values[2], values[3]]]
      : op === 'Q' ? [[values[0], values[1]]] : [];
    const next = [...controls, target].find((point) => different(point, cursor));
    const previous = [...controls].reverse().concat([cursor]).find((point) => different(point, target));
    if (!first && next) first = { tip: cursor, inner: next };
    if (previous) last = { tip: target, inner: previous };
    cursor = target;
  }
  const size = vectorArrowSize(width);
  return [start ? first : undefined, end ? last : undefined].flatMap((arrow) => {
    if (!arrow) return [];
    const dx = arrow.inner[0] - arrow.tip[0], dy = arrow.inner[1] - arrow.tip[1];
    const length = Math.hypot(dx, dy);
    if (!length) return [];
    const ux = dx / length, uy = dy / length;
    // Match the 2D SVG marker's viewBox 0..10 and refX=9: its tip extends
    // one tenth of the marker length beyond the path endpoint.
    return [[
      [arrow.tip[0] - ux * size / 10, arrow.tip[1] - uy * size / 10] as Point,
      [arrow.tip[0] + ux * size * 0.9 - uy * size / 2, arrow.tip[1] + uy * size * 0.9 + ux * size / 2] as Point,
      [arrow.tip[0] + ux * size * 0.9 + uy * size / 2, arrow.tip[1] + uy * size * 0.9 - ux * size / 2] as Point,
    ]];
  });
}

/** Validation happens before any path painting or image decoding. Labels are
 * semantic only: separate TextNodes carry visible text in the generated graph. */
export function getFlatArtworkPlan(node: DiagramSceneNode): FlatArtworkPlan {
  if (node.type === 'VectorPathNode' && isVectorGeometry(node.data.vector)) {
    const vector = node.data.vector;
    const appearance = resolveVectorAppearance(vector, node.data);
    const padding = Math.ceil(appearance.strokeWidth / 2 + (vector.startArrow || vector.endArrow ? vectorArrowSize(appearance.strokeWidth) : 0) + 2);
    const layout = bounds(node, padding);
    const commands = vectorCommandsInBox(vector, layout.width, layout.height);
    return {
      ...layout, kind: 'vector', commands, appearance,
      opacity: appearance.opacity,
      arrows: appearance.stroke !== 'none' && appearance.stroke !== 'transparent' && appearance.strokeWidth > 0
        ? vectorArrowTriangles(commands, appearance.strokeWidth, vector.startArrow, vector.endArrow) : [],
    };
  }
  if (node.type === 'SourceImageNode' && isSourceImageData(node.data.image)) {
    const { dataUrl, width, height, reason } = node.data.image;
    return { ...bounds(node, 0), kind: 'image', image: { dataUrl, width, height, reason } };
  }
  return { ...bounds(node, 0), kind: 'invalid', error: 'This flat artwork is invalid or unavailable.' };
}

/** Paint numeric commands directly. No raw SVG, HTML, URL or user code parser. */
export function paintVectorArtwork(context: CanvasRenderingContext2D, plan: Extract<FlatArtworkPlan, { kind: 'vector' }>): void {
  context.save();
  context.scale(plan.textureWidth / (plan.width + plan.padding * 2), plan.textureHeight / (plan.height + plan.padding * 2));
  context.translate(plan.padding, plan.padding);
  context.beginPath();
  for (const { op, values: v } of plan.commands) {
    if (op === 'M') context.moveTo(v[0], v[1]);
    else if (op === 'L') context.lineTo(v[0], v[1]);
    else if (op === 'Q') context.quadraticCurveTo(v[0], v[1], v[2], v[3]);
    else if (op === 'C') context.bezierCurveTo(v[0], v[1], v[2], v[3], v[4], v[5]);
    else context.closePath();
  }
  const { fill, stroke, strokeWidth, dashArray } = plan.appearance;
  if (fill !== 'none') { context.fillStyle = fill; context.fill(); }
  if (stroke !== 'none' && strokeWidth > 0) {
    context.strokeStyle = stroke; context.lineWidth = strokeWidth;
    context.lineCap = 'round'; context.lineJoin = 'round';
    context.setLineDash(dashArray ? dashArray.split(/[ ,]+/).map(Number) : []);
    context.stroke();
    context.setLineDash([]); context.fillStyle = stroke;
    for (const [tip, left, right] of plan.arrows) {
      context.beginPath(); context.moveTo(...tip); context.lineTo(...left); context.lineTo(...right); context.closePath(); context.fill();
    }
  }
  context.restore();
}
