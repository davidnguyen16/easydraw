import type { DiagramSceneNode, Vec3 } from './scene-model';
import { VARIANTS } from '../flow/nodes/shape-geometry';
import { resolveFieldKey, type EntityField } from '../flow/nodes/entity-relation/entity/types';
import { getNodeVisualDefinition } from './visual-catalog';

export interface SurfaceTextStyle {
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
}
export interface SurfaceText {
  kind: 'text';
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: SurfaceTextStyle;
  verticalAlign: 'top' | 'middle';
  multiline: boolean;
}
export interface SurfaceRect {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  radius?: number;
}
export type SurfaceCommand = SurfaceText | SurfaceRect;
export interface NodeLabelLayout {
  /** Canvas layout coordinates are the same pixels used by the 2D editor. */
  width: number;
  height: number;
  position: Vec3;
  surface: 'top' | 'sphere' | 'front';
  size: Vec3;
  clip: 'none' | 'ellipse' | 'card';
  cardRadius: number;
  opacity: number;
  commands: SurfaceCommand[];
}

const FONT = 'Inter, system-ui, -apple-system, sans-serif';
const MAX_TEXT = 20_000;
const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown, fallback = '') => typeof value === 'string' || typeof value === 'number' && Number.isFinite(value) ? String(value).slice(0, MAX_TEXT) : fallback;

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^(#[\da-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d\s.,%+-]+\))$/i.test(value)
    && !['none', 'currentcolor', 'inherit'].includes(value.toLowerCase()) ? value : fallback;
}

function textStyle(data: Record<string, unknown>, defaultSize: number, defaultWeight: number, defaultAlign: SurfaceTextStyle['align'] = 'center'): SurfaceTextStyle {
  return {
    color: color(data.textColor, '#2c2c2a'),
    fontFamily: typeof data.fontFamily === 'string' && data.fontFamily.trim() && data.fontFamily !== 'inherit' ? data.fontFamily : FONT,
    fontSize: Math.max(6, Math.min(144, finite(data.fontSize, defaultSize))),
    fontWeight: data.bold === true ? 700 : defaultWeight,
    italic: data.italic === true,
    underline: data.underline === true,
    align: data.textAlign === 'left' || data.textAlign === 'right' || data.textAlign === 'center' ? data.textAlign : defaultAlign,
  };
}

/** Use the actual SVG cap height, rather than a floating panel above its bounds. */
function topHeight(node: DiagramSceneNode): number {
  const definition = getNodeVisualDefinition(node.type, node.data);
  if (definition.kind !== 'svg') return node.size[1] / 2;
  const paths = [...(definition.svg ?? '').matchAll(/<(?:path|rect|ellipse|polygon|circle|line|polyline)\b[^>]*>/g)].map((match) => match[0]);
  let index = 0;
  for (let i = 0; i < paths.length; i++) if (!/\bfill="none"/.test(paths[i])) index = i;
  return node.size[1] * (0.4 + index / Math.max(1, paths.length) * 0.08);
}

const BADGES: Record<string, [string, string]> = {
  PK: ['#fae9c8', '#854f0b'], FK: ['#dce9fa', '#1e4380'],
  PI: ['#c8eae0', '#0b6354'], WPI: ['#e3d8fa', '#5a3fb0'],
};

function entityCommands(node: DiagramSceneNode, width: number, height: number): SurfaceCommand[] {
  const data = node.data;
  const title = textStyle(data, 13, 500);
  const headerHeight = Math.min(height, title.fontSize * 1.5 + 16);
  const border = color(data.borderColor, '#373a36');
  const commands: SurfaceCommand[] = [
    { kind: 'rect', x: 0, y: 0, width, height: headerHeight, fill: color(data.fillColor, '#ffffff') },
    { kind: 'rect', x: 0, y: headerHeight, width, height: 1, fill: border },
    { kind: 'text', text: string(data.label), x: 12, y: 8, width: Math.max(0, width - 24), height: Math.max(0, headerHeight - 16), style: title, verticalAlign: 'middle', multiline: false },
  ];
  const fields = Array.isArray(data.fields) ? data.fields : [];
  const nameStyle: SurfaceTextStyle = { ...title, fontSize: 12, fontWeight: 400, italic: false, underline: false, align: 'left', color: color(data.textColor, '#373a36') };
  const rowHeight = 34.5;
  for (let i = 0; i < Math.min(fields.length, 100); i++) {
    const y = headerHeight + 1 + i * rowHeight;
    if (y >= height) break;
    const field = record(fields[i]);
    const key = resolveFieldKey(field as unknown as EntityField);
    const keys = [key, field.optionalKey].filter((value): value is string => typeof value === 'string' && value in BADGES);
    if (i) commands.push({ kind: 'rect', x: 0, y, width, height: 0.5, fill: '#d6d2c4' });
    let badgeX = 12;
    for (const key of keys) {
      const [fill, ink] = BADGES[key];
      const badgeWidth = key.length * 6.5 + 10;
      commands.push({ kind: 'rect', x: badgeX, y: y + 9, width: badgeWidth, height: 16, radius: 2, fill });
      commands.push({ kind: 'text', text: key, x: badgeX, y: y + 9, width: badgeWidth, height: 16, style: { ...nameStyle, color: ink, fontSize: 10, fontWeight: 600, align: 'center' }, verticalAlign: 'middle', multiline: false });
      badgeX += badgeWidth + 4;
    }
    const nameX = 12 + Math.max(36, badgeX - 12 - (keys.length ? 4 : 0)) + 8;
    const type = data.showDataTypes === true ? string(field.type).toUpperCase() : '';
    const typeWidth = type ? Math.min(Math.max(0, width - nameX - 28) * 0.5, type.length * 6.6) : 0;
    commands.push({ kind: 'text', text: string(field.name), x: nameX, y: y + 8, width: Math.max(0, width - nameX - 12 - (type ? typeWidth + 8 : 0)), height: 18, style: { ...nameStyle, fontWeight: key === 'PK' ? 500 : 400 }, verticalAlign: 'middle', multiline: false });
    if (type) commands.push({ kind: 'text', text: type, x: width - 12 - typeWidth, y: y + 8, width: typeWidth, height: 18, style: { ...nameStyle, color: '#888888', fontSize: 11, align: 'right' }, verticalAlign: 'middle', multiline: false });
  }
  return commands;
}

/** Pure drawing recipe; camera, selection, position, and rotation do not affect it. */
export function getNodeLabelLayout(node: DiagramSceneNode): NodeLabelLayout | null {
  // Their label describes the recognized artwork; actual visible text is a
  // separate TextNode (or already present in the bounded source-image pixels).
  if (node.type === 'VectorPathNode' || node.type === 'SourceImageNode') return null;
  const width = Math.max(2, finite(node.size[0] * 100, 100));
  const height = Math.max(2, finite(node.size[2] * 100, 100));
  const data = node.data;
  const entity = node.type === 'EntityNode' || node.type === 'WeakEntityNode';
  const opacity = Math.max(0, Math.min(1, finite(data.opacity, 100) / 100));
  const base: NodeLabelLayout = {
    width, height, size: [...node.size], position: [0, topHeight(node) + 0.001, 0],
    surface: 'top', clip: entity ? 'card' : 'none', cardRadius: entity && data.rounded !== false ? 4 : 0,
    opacity, commands: [],
  };
  if (entity) return { ...base, commands: entityCommands(node, width, height) };

  // Explicitly empty labels stay empty; internal IDs must never become artwork.
  const label = string(data.label, string(data.title, string(data.name)));
  if (!label.trim()) return null;
  const style = textStyle(data, 14, 400);
  const placement = VARIANTS[node.type]?.labelPlacement ?? (node.type === 'ActorNode' || node.type === 'CustomImageNode' ? 'below' : 'center');
  const command: SurfaceText = { kind: 'text', text: label, x: 12, y: 8, width: Math.max(0, width - 24), height: Math.max(0, height - 16), style, verticalAlign: 'middle', multiline: true };
  if (placement === 'below') {
    const labelWidth = Math.max(width, 96);
    // A bounded transparent caption follows the object, never the camera. The
    // rasterizer performs exact font-metric wrapping inside this generous box.
    const lines = label.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length * style.fontSize * 0.65 / Math.max(1, labelWidth - 8))), 0);
    const labelHeight = Math.min(512, Math.max(style.fontSize * 1.25, Math.min(16, lines) * style.fontSize * 1.25));
    command.x = 4; command.y = 0; command.width = labelWidth - 8; command.height = labelHeight; command.verticalAlign = 'top';
    return { ...base, width: labelWidth, height: labelHeight,
      surface: node.type === 'ActorNode' ? 'front' : 'top',
      position: node.type === 'ActorNode'
        ? [0, -node.size[1] / 2 - 0.04 - labelHeight / 200, node.size[2] * 0.05]
        : [0, topHeight(node) + 0.001, node.size[2] / 2 + 0.04 + labelHeight / 200],
      commands: [command],
    };
  }
  if (placement === 'header') Object.assign(command, { x: 12, y: height * 0.01, width: Math.max(0, width - 24), height: height * 0.2 });
  else if (placement === 'top-left') Object.assign(command, { x: width * 0.03 + 4, y: height * 0.03 + 4, width: Math.max(0, width * 0.94 - 8), height: Math.max(0, height * 0.94 - 8), verticalAlign: 'top' });
  else if (placement === 'tab') Object.assign(command, { x: width * 0.01 + 8, y: height * 0.01 + 2, width: Math.max(0, width * 0.27 - 16), height: Math.max(0, height * 0.17 - 4) });
  const kind = getNodeVisualDefinition(node.type, data).kind;
  return { ...base, surface: kind === 'sphere' ? 'sphere' : 'top', clip: kind === 'sphere' || kind === 'cylinder' ? 'ellipse' : 'none', commands: [command] };
}

/** Layout itself is the cache key: editing transforms never rerasterize text. */
export function nodeLabelLayoutKey(layout: NodeLabelLayout | null): string {
  return JSON.stringify(layout);
}
