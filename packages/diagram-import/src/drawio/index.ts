/**
 * draw.io / diagrams.net importer.
 *
 * A file is `<mxfile>` holding one `<diagram>` per page (each either raw
 * `<mxGraphModel>` XML or a base64 + raw-deflate + URI-encoded copy of it),
 * or a bare `<mxGraphModel>`. Inside, every object is an `<mxCell>`: layers
 * (parent 0), vertices (`vertex="1"` + `<mxGeometry>`), edges (`edge="1"`,
 * `source`/`target` ids or free `sourcePoint`/`targetPoint`) and edge labels
 * (vertices whose parent is an edge). Child geometry is relative to the
 * parent cell, so groups and containers are resolved to page coordinates.
 */
import { inflateSync } from 'fflate';
import type { DiagramEdge, DiagramNode } from '@easydraw/diagram-schema';
import {
  WarningSink, buildAnchorNode, buildDocument, buildEdge, buildNode, centerOf, handleFromFraction,
  htmlToText, normaliseColor, pickHandle, ANCHOR_HANDLE_ID,
  type EdgeLabelSpec, type HandleId, type ImportResult, type LineStyle, type NodeStyle, type Point, type Rect, type Routing,
} from '../document.js';
import { XmlParseError, attr, child, children, ownText, parseDocument, type XmlElement } from '../xml.js';
import { markersOf } from './markers.js';
import { matchShape } from './shapes.js';
import { fontFlags, nodeStyleOf, parseStyle, type DrawioStyle } from './style.js';

interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
  relative: boolean;
  points: Point[];
  sourcePoint?: Point;
  targetPoint?: Point;
}

interface Cell {
  id: string;
  value: string;
  style: DrawioStyle;
  vertex: boolean;
  edge: boolean;
  parent: string | undefined;
  source: string | undefined;
  target: string | undefined;
  geometry: Geometry | undefined;
  children: Cell[];
}

export function looksLikeDrawio(text: string): boolean {
  return /<(mxfile|mxGraphModel)[\s>]/.test(text.slice(0, 4000));
}

export function importDrawio(text: string, fileName: string): ImportResult {
  let root: XmlElement;
  try {
    root = parseDocument(text);
  } catch (error) {
    return { ok: false, format: 'drawio', error: `Not well-formed XML: ${(error as XmlParseError).message}` };
  }

  let models: { name: string; model: XmlElement }[];
  try {
    models = collectModels(root);
  } catch (error) {
    return { ok: false, format: 'drawio', error: error instanceof Error ? error.message : String(error) };
  }
  if (models.length === 0) {
    return { ok: false, format: 'drawio', error: 'No <diagram> or <mxGraphModel> found in the file.' };
  }

  const warnings = new WarningSink();
  const pages = models.map(({ name, model }, index) => {
    const page = new PageBuilder(model, `p${index + 1}`, warnings);
    const built = page.build();
    if (built.nodes.length === 0 && built.edges.length === 0) warnings.add('page.empty');
    return { name, ...built };
  });

  const document = buildDocument(pages, fileName);
  return {
    ok: true,
    format: 'drawio',
    document,
    warnings: warnings.list(),
    stats: {
      pages: pages.length,
      nodes: pages.reduce((n, p) => n + p.nodes.filter((node) => node.type !== 'connection-anchor').length, 0),
      edges: pages.reduce((n, p) => n + p.edges.length, 0),
    },
  };
}

// ── File structure ──────────────────────────────────────────────────────

function collectModels(root: XmlElement): { name: string; model: XmlElement }[] {
  if (root.name === 'mxGraphModel') return [{ name: 'Page 1', model: root }];
  if (root.name === 'diagram') return [{ name: attr(root, 'name') ?? 'Page 1', model: modelOfDiagram(root) }];
  if (root.name !== 'mxfile') throw new Error(`Expected <mxfile> or <mxGraphModel>, found <${root.name}>.`);
  return children(root, 'diagram').map((diagram, index) => ({
    name: attr(diagram, 'name') ?? `Page ${index + 1}`,
    model: modelOfDiagram(diagram),
  }));
}

function modelOfDiagram(diagram: XmlElement): XmlElement {
  const inline = child(diagram, 'mxGraphModel');
  if (inline) return inline;
  const packed = ownText(diagram).trim();
  if (!packed) throw new Error(`Page "${attr(diagram, 'name') ?? ''}" is empty.`);
  const xml = decompressDiagram(packed);
  const root = parseDocument(xml);
  if (root.name !== 'mxGraphModel') throw new Error('Compressed page did not contain <mxGraphModel>.');
  return root;
}

/** base64 → raw deflate → percent-encoded UTF-8, exactly as draw.io packs it. */
export function decompressDiagram(packed: string): string {
  const bytes = base64ToBytes(packed.replace(/\s+/g, ''));
  let inflated: Uint8Array;
  try {
    inflated = inflateSync(bytes);
  } catch {
    throw new Error('Compressed page could not be inflated.');
  }
  const encoded = new TextDecoder().decode(inflated);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Plain base64 decoder: the same code path in Node and the browser. */
function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const ch of clean) {
    const value = BASE64.indexOf(ch);
    if (value === -1) throw new Error('Compressed page is not valid base64.');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, index);
}

// ── One page ────────────────────────────────────────────────────────────

class PageBuilder {
  private readonly cells = new Map<string, Cell>();
  private readonly order: Cell[] = [];
  /** Cells already emitted (or absorbed into another node), by id. */
  private readonly consumed = new Set<string>();
  /** Rect of every emitted node, for handle picking. */
  private readonly rects = new Map<string, Rect>();
  private readonly nodes: DiagramNode[] = [];
  private readonly edges: DiagramEdge[] = [];
  private anchorCount = 0;

  constructor(model: XmlElement, private readonly idPrefix: string, private readonly warnings: WarningSink) {
    const root = child(model, 'root');
    if (root) this.readCells(root);
  }

  build(): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
    for (const cell of this.order) {
      if (cell.vertex && !this.consumed.has(cell.id)) this.emitVertex(cell);
    }
    for (const cell of this.order) {
      if (cell.edge && !this.consumed.has(cell.id)) this.emitEdge(cell);
    }
    return { nodes: this.nodes, edges: this.edges };
  }

  private readCells(root: XmlElement): void {
    for (const element of children(root)) {
      // <object label="…" id="…"><mxCell …/></object> wraps a cell with custom
      // data; the label and id then live on the wrapper.
      const inner = element.name === 'mxCell' ? element : child(element, 'mxCell');
      if (!inner) continue;
      const id = attr(element, 'id') ?? attr(inner, 'id');
      if (!id) continue;
      const value = element === inner ? attr(inner, 'value') ?? '' : attr(element, 'label') ?? attr(inner, 'value') ?? '';
      const cell: Cell = {
        id,
        value,
        style: parseStyle(attr(inner, 'style')),
        vertex: attr(inner, 'vertex') === '1',
        edge: attr(inner, 'edge') === '1',
        parent: attr(inner, 'parent'),
        source: attr(inner, 'source'),
        target: attr(inner, 'target'),
        geometry: readGeometry(child(inner, 'mxGeometry')),
        children: [],
      };
      this.cells.set(id, cell);
      this.order.push(cell);
    }
    for (const cell of this.order) {
      const parent = cell.parent ? this.cells.get(cell.parent) : undefined;
      if (parent) parent.children.push(cell);
    }
  }

  /** Page-space offset contributed by every ancestor with a geometry. */
  private originOf(cell: Cell): Point {
    let x = 0;
    let y = 0;
    let parent = cell.parent ? this.cells.get(cell.parent) : undefined;
    let guard = 0;
    while (parent && guard++ < 64) {
      if (parent.geometry && !parent.edge) {
        x += parent.geometry.x;
        y += parent.geometry.y;
      }
      parent = parent.parent ? this.cells.get(parent.parent) : undefined;
    }
    return { x, y };
  }

  private rectOf(cell: Cell): Rect | undefined {
    if (!cell.geometry) return undefined;
    const origin = this.originOf(cell);
    return { x: origin.x + cell.geometry.x, y: origin.y + cell.geometry.y, width: cell.geometry.width, height: cell.geometry.height };
  }

  private nodeId(cell: Cell): string {
    return `${this.idPrefix}-${cell.id}`;
  }

  private labelOf(cell: Cell): string {
    const { text, hadMarkup } = htmlToText(cell.value);
    if (hadMarkup && /<(b|i|u|font|span|strong|em|table|img)\b/i.test(cell.value)) {
      this.warnings.add('text.formatting-dropped', 'HTML');
    }
    return text;
  }

  // ── Vertices ──

  private emitVertex(cell: Cell): void {
    const parent = cell.parent ? this.cells.get(cell.parent) : undefined;
    if (parent?.edge) return; // an edge label; emitted with its edge
    const rect = this.rectOf(cell);
    if (!rect) return;
    const style = cell.style;

    if (style.flags.has('group') && !style.has('shape')) {
      this.warnings.add('group.flattened');
      this.consumed.add(cell.id);
      return;
    }
    if (style.shape === 'table' || style.get('childLayout') === 'tableLayout') {
      this.emitEntity(cell, rect, this.tableRows(cell));
      return;
    }
    if (style.shape === 'swimlane' || style.flags.has('swimlane')) {
      const textChildren = cell.children.filter((c) => c.vertex);
      const allText = textChildren.length > 0 && textChildren.every((c) => c.style.shape === 'text' || c.style.shape === 'line');
      if (allText) {
        this.emitEntity(cell, rect, textChildren.filter((c) => c.style.shape === 'text').map((c) => this.labelOf(c)));
        return;
      }
      this.warnings.add('container.flattened', 'swimlanes');
      this.emitContainer(cell, rect);
      return;
    }
    if (style.shape === 'image' || style.has('image')) {
      this.warnings.add('image.dropped');
      this.pushNode(cell, rect, 'RectangleNode');
      return;
    }
    if (style.shape === 'waypoint' || style.shape === 'point' || style.flags.has('point')) {
      this.consumed.add(cell.id);
      return;
    }

    const match = matchShape(style, rect.width, rect.height);
    if (!match) {
      this.warnings.add('shape.unsupported', style.shape);
      this.pushNode(cell, rect, 'RectangleNode');
      return;
    }
    if (match.fidelity === 'approximate') this.warnings.add('shape.approximated', style.shape);
    const extra: NodeStyle = {};
    if (match.rotation) extra.rotation = style.number('rotation', 0) + match.rotation;
    if (match.type === 'EntityNode' || match.type === 'WeakEntityNode') {
      this.emitEntity(cell, rect, [], match.type === 'WeakEntityNode');
      return;
    }
    this.pushNode(cell, rect, match.type, extra);
  }

  private pushNode(cell: Cell, rect: Rect, type: string, extra: NodeStyle = {}, zIndex?: number): void {
    const nodeStyle = { ...nodeStyleOf(cell.style), ...extra };
    if (type === 'TextNode') {
      delete nodeStyle.fillColor;
      delete nodeStyle.borderColor;
    }
    const spec = { id: this.nodeId(cell), type, ...rect, label: this.labelOf(cell), style: nodeStyle } as const;
    this.nodes.push(buildNode(zIndex === undefined ? spec : { ...spec, zIndex }));
    this.rects.set(this.nodeId(cell), rect);
    this.consumed.add(cell.id);
  }

  /**
   * A swimlane/pool is a box with a title strip (`startSize` px tall). The
   * body becomes a rectangle behind everything and the title a text node on
   * the strip, so the import reads like the original without a container
   * node type.
   */
  private emitContainer(cell: Cell, rect: Rect): void {
    const title = this.labelOf(cell);
    const style = nodeStyleOf(cell.style);
    const id = this.nodeId(cell);
    this.nodes.push(buildNode({ id, type: 'RectangleNode', ...rect, label: '', style: { ...style, textAlign: 'center' }, zIndex: -1 }));
    if (title) {
      const strip = cell.style.on('horizontal') || !cell.style.has('horizontal')
        ? { x: rect.x, y: rect.y, width: rect.width, height: Math.min(rect.height, cell.style.number('startSize', 23)) }
        : { x: rect.x, y: rect.y, width: Math.min(rect.width, cell.style.number('startSize', 23)), height: rect.height };
      const { fillColor: _fill, borderColor: _border, ...textStyle } = style;
      this.nodes.push(buildNode({ id: `${id}-title`, type: 'TextNode', ...strip, label: title, style: { bold: true, ...textStyle, textAlign: 'center' }, zIndex: -1 }));
    }
    this.rects.set(id, rect);
    this.consumed.add(cell.id);
  }

  private emitEntity(cell: Cell, rect: Rect, fields: string[], weak = false): void {
    for (const c of cell.children) this.consumeSubtree(c);
    const names = fields.map((f) => f.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const style = nodeStyleOf(cell.style);
    delete style.textAlign;
    this.nodes.push(buildNode({
      id: this.nodeId(cell),
      type: weak ? 'WeakEntityNode' : 'EntityNode',
      ...rect,
      height: undefined, // entities size themselves from their rows
      label: this.labelOf(cell) || 'Entity',
      style,
      data: { weak, fields: names.length ? names.map((name) => ({ name })) : [{ name: 'field' }] },
    }));
    this.rects.set(this.nodeId(cell), rect);
    this.consumed.add(cell.id);
  }

  /** draw.io ER table: rows of cells; each row becomes "col1 col2 col3". */
  private tableRows(table: Cell): string[] {
    return table.children
      .filter((row) => row.vertex)
      .map((row) => row.children.filter((c) => c.vertex).map((c) => this.labelOf(c)).filter(Boolean).join(' ') || this.labelOf(row));
  }

  private consumeSubtree(cell: Cell): void {
    this.consumed.add(cell.id);
    for (const c of cell.children) this.consumeSubtree(c);
  }

  // ── Edges ──

  private emitEdge(cell: Cell): void {
    const style = cell.style;
    const origin = this.originOf(cell);
    const geometry = cell.geometry;
    const toPage = (p: Point): Point => ({ x: origin.x + p.x, y: origin.y + p.y });
    const bendPoints = (geometry?.points ?? []).map(toPage);

    const sourceNode = this.attachedNode(cell.source);
    const targetNode = this.attachedNode(cell.target);
    const sourceRect = sourceNode ? this.rects.get(sourceNode) : undefined;
    const targetRect = targetNode ? this.rects.get(targetNode) : undefined;
    const sourceFree = geometry?.sourcePoint ? toPage(geometry.sourcePoint) : undefined;
    const targetFree = geometry?.targetPoint ? toPage(geometry.targetPoint) : undefined;

    if (!sourceRect && !sourceFree) return this.skipEdge(cell);
    if (!targetRect && !targetFree) return this.skipEdge(cell);

    const towardTarget = bendPoints[0] ?? (targetRect ? centerOf(targetRect) : targetFree!);
    const towardSource = bendPoints[bendPoints.length - 1] ?? (sourceRect ? centerOf(sourceRect) : sourceFree!);

    let source: string;
    let sourceHandle: HandleId | typeof ANCHOR_HANDLE_ID;
    if (sourceRect && sourceNode) {
      source = sourceNode;
      sourceHandle = style.has('exitX') && style.has('exitY')
        ? handleFromFraction(style.number('exitX', 0.5), style.number('exitY', 0.5))
        : pickHandle(sourceRect, towardTarget);
    } else {
      source = this.anchor(sourceFree!);
      sourceHandle = ANCHOR_HANDLE_ID;
    }
    let target: string;
    let targetHandle: HandleId | typeof ANCHOR_HANDLE_ID;
    if (targetRect && targetNode) {
      target = targetNode;
      targetHandle = style.has('entryX') && style.has('entryY')
        ? handleFromFraction(style.number('entryX', 0.5), style.number('entryY', 0.5))
        : pickHandle(targetRect, towardSource);
    } else {
      target = this.anchor(targetFree!);
      targetHandle = ANCHOR_HANDLE_ID;
    }

    const labels: EdgeLabelSpec[] = [];
    const own = this.labelOf(cell);
    if (own) labels.push({ text: own, t: 0.5 });
    for (const c of cell.children) {
      if (!c.vertex) continue;
      this.consumed.add(c.id);
      const text = this.labelOf(c);
      if (!text) continue;
      // Relative edge geometry: x runs -1 (source) … 1 (target).
      const x = c.geometry?.relative ? c.geometry.x : 0;
      labels.push({ text, t: (Math.max(-1, Math.min(1, x)) + 1) / 2 });
    }

    const edgeStyle = style.get('edgeStyle');
    let routing: Routing;
    if (style.on('curved')) {
      routing = 'curved';
      if (bendPoints.length) this.warnings.add('edge.curve-approximated');
    } else if (edgeStyle && edgeStyle !== 'none') {
      routing = 'orthogonal';
    } else {
      routing = bendPoints.length ? 'orthogonal' : 'straight';
    }

    const text = { ...fontFlags(style) } as NonNullable<Parameters<typeof buildEdge>[0]['text']>;
    if (style.has('fontSize')) text.fontSize = style.number('fontSize', 11);
    const fontColor = normaliseColor(style.get('fontColor'));
    if (fontColor && fontColor !== 'transparent') text.textColor = fontColor;

    const strokeColor = normaliseColor(style.get('strokeColor'));
    const edge = buildEdge({
      id: `${this.idPrefix}-${cell.id}`,
      source,
      target,
      sourceHandle,
      targetHandle,
      bendPoints: routing === 'straight' ? [] : bendPoints,
      labels,
      ...markersOf(style),
      lineStyle: lineStyleOf(style),
      routing,
      ...(style.has('strokeWidth') ? { strokeWidth: style.number('strokeWidth', 1) } : {}),
      ...(strokeColor ? { strokeColor } : {}),
      text,
    });
    this.edges.push(edge);
    this.consumed.add(cell.id);
  }

  private attachedNode(cellId: string | undefined): string | undefined {
    if (!cellId) return undefined;
    const cell = this.cells.get(cellId);
    if (!cell) return undefined;
    const id = this.nodeId(cell);
    if (this.rects.has(id)) return id;
    // Attached to something we absorbed (a table row, a stack member): climb
    // to the nearest emitted ancestor so the connection still lands.
    let parent = cell.parent ? this.cells.get(cell.parent) : undefined;
    while (parent) {
      const parentId = this.nodeId(parent);
      if (this.rects.has(parentId)) return parentId;
      parent = parent.parent ? this.cells.get(parent.parent) : undefined;
    }
    return undefined;
  }

  private anchor(point: Point): string {
    this.warnings.add('edge.dangling');
    const id = `${this.idPrefix}-anchor-${++this.anchorCount}`;
    this.nodes.push(buildAnchorNode(id, point));
    return id;
  }

  private skipEdge(cell: Cell): void {
    this.warnings.add('edge.skipped');
    this.consumed.add(cell.id);
  }
}

function readGeometry(element: XmlElement | undefined): Geometry | undefined {
  if (!element) return undefined;
  const num = (name: string) => Number(attr(element, name) ?? 0) || 0;
  const geometry: Geometry = {
    x: num('x'),
    y: num('y'),
    width: num('width'),
    height: num('height'),
    relative: attr(element, 'relative') === '1',
    points: [],
  };
  for (const c of children(element)) {
    const as = attr(c, 'as');
    if (c.name === 'mxPoint' && as === 'sourcePoint') geometry.sourcePoint = pointOf(c);
    else if (c.name === 'mxPoint' && as === 'targetPoint') geometry.targetPoint = pointOf(c);
    else if (c.name === 'Array' && as === 'points') geometry.points = children(c, 'mxPoint').map(pointOf);
  }
  return geometry;
}

function pointOf(element: XmlElement): Point {
  return { x: Number(attr(element, 'x') ?? 0) || 0, y: Number(attr(element, 'y') ?? 0) || 0 };
}

function lineStyleOf(style: DrawioStyle): LineStyle {
  if (!style.on('dashed')) return 'solid';
  const pattern = style.get('dashPattern');
  if (pattern) {
    const [dash, gap] = pattern.split(/\s+/).map(Number);
    if (dash !== undefined && gap !== undefined && dash <= 1.5 && gap <= 3) return 'dotted';
  }
  return 'dashed';
}
