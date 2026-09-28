/**
 * draw.io stores a cell's look as one string: `shape;key=value;key=value;`.
 * The first bare token (no `=`) is usually the shape name — `ellipse`,
 * `rhombus`, `text`, `swimlane` — and `shape=…` overrides it when present.
 */
import { type NodeStyle, type TextAlign, normaliseColor, toNumber } from '../document.js';

export interface DrawioStyle {
  /** `shape=` value, else the first bare token, else '' (a plain rectangle). */
  shape: string;
  /** Every bare token, e.g. `ellipse`, `group`, `edgeLabel`. */
  flags: ReadonlySet<string>;
  get(key: string): string | undefined;
  has(key: string): boolean;
  number(key: string, fallback: number): number;
  /** True when the key is present and not `0`. */
  on(key: string): boolean;
}

export function parseStyle(raw: string | undefined): DrawioStyle {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (const token of (raw ?? '').split(';')) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) flags.add(trimmed);
    else values.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }
  const first = flags.values().next();
  const shape = values.get('shape') ?? (first.done ? '' : first.value);
  return {
    shape,
    flags,
    get: (key) => values.get(key),
    has: (key) => values.has(key),
    number: (key, fallback) => toNumber(values.get(key), fallback),
    on: (key) => values.has(key) && values.get(key) !== '0',
  };
}

/** draw.io `fontStyle` is a bit set: 1 bold, 2 italic, 4 underline. */
export function fontFlags(style: DrawioStyle): Pick<NodeStyle, 'bold' | 'italic' | 'underline'> {
  const bits = style.number('fontStyle', 0);
  const out: Pick<NodeStyle, 'bold' | 'italic' | 'underline'> = {};
  if (bits & 1) out.bold = true;
  if (bits & 2) out.italic = true;
  if (bits & 4) out.underline = true;
  return out;
}

export function textAlign(style: DrawioStyle): TextAlign | undefined {
  const align = style.get('align');
  return align === 'left' || align === 'center' || align === 'right' ? align : undefined;
}

/** Node style fields shared by every vertex, whatever its shape. */
export function nodeStyleOf(style: DrawioStyle): NodeStyle {
  const out: NodeStyle = { ...fontFlags(style) };
  const fill = normaliseColor(style.get('fillColor'));
  const stroke = normaliseColor(style.get('strokeColor'));
  const font = normaliseColor(style.get('fontColor'));
  if (fill) out.fillColor = fill;
  if (stroke) out.borderColor = stroke;
  if (style.has('strokeWidth')) out.borderWidth = style.number('strokeWidth', 1);
  if (font && font !== 'transparent') out.textColor = font;
  if (style.has('fontSize')) out.fontSize = style.number('fontSize', 12);
  const family = style.get('fontFamily');
  if (family) out.fontFamily = family;
  const align = textAlign(style);
  if (align) out.textAlign = align;
  if (style.has('opacity')) out.opacity = Math.round(style.number('opacity', 100));
  if (style.has('rotation')) out.rotation = style.number('rotation', 0);
  return out;
}
