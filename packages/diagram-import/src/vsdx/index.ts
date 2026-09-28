/**
 * Visio VSDX importer — also the way in for Lucidchart, whose only
 * structure-preserving export is "Visio (VSDX)".
 *
 * A .vsdx is a zip: `visio/pages/pages.xml` lists pages (size, name) and
 * `visio/pages/pageN.xml` holds each page's `<Shape>` tree. A shape is a bag
 * of `<Cell N V>` values in inches with the origin at the page's bottom-left
 * and y pointing up; cells it does not state are inherited from its master
 * (`visio/masters/masterN.xml`). Connectors are 1-D shapes whose ends are
 * glued to other shapes through the page's `<Connects>` list.
 */
import { unzipSync } from 'fflate';
import type { DiagramEdge, DiagramNode } from '@easydraw/diagram-schema';
import {
  WarningSink, buildAnchorNode, buildDocument, buildEdge, buildNode, htmlToText, pickHandle, round, ANCHOR_HANDLE_ID,
  type HandleId, type ImportResult, type LineStyle, type NodeStyle, type Point, type Rect, type Routing, type TextAlign,
} from '../document.js';
import { attr, child, children, deepText, parseDocument, type XmlElement } from '../xml.js';
import { markerOf } from './arrows.js';
import { classifyGeometry, isOutline, type GeometrySection } from './geometry.js';

const PX_PER_INCH = 96;

interface VShape {
  id: string;
  name: string;
  type: string;
  masterId: string | undefined;
  masterShapeId: string | undefined;
  cells: Map<string, string>;
  char: Map<string, string>;
  para: Map<string, string>;
  geometry: GeometrySection[];
  text: string;
  children: VShape[];
  /** Resolved inheritance source, set while building a page. */
  master?: VShape;
}

interface MasterFile {
  name: string;
  top: VShape | undefined;
  byId: Map<string, VShape>;
}

interface VPage {
  name: string;
  width: number;
  height: number;
  shapes: VShape[];
  connects: { from: string; fromCell: string; to: string }[];
}

export function looksLikeVsdx(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export function importVsdx(bytes: Uint8Array, fileName: string): ImportResult {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    return { ok: false, format: 'vsdx', error: 'The file is not a readable zip archive.' };
  }
  const xml = (path: string): XmlElement | undefined => {
    const data = entries[path];
    return data ? parseDocument(new TextDecoder().decode(data)) : undefined;
  };

  const pagesIndex = xml('visio/pages/pages.xml');
  if (!pagesIndex) {
    return { ok: false, format: 'vsdx', error: 'This zip has no visio/pages — it is not a Visio VSDX drawing.' };
  }

  const warnings = new WarningSink();
  const masters = readMasters(xml);
  const pageRels = readRels(xml('visio/pages/_rels/pages.xml.rels'));
  const pages: VPage[] = [];
  for (const pageEl of children(pagesIndex, 'Page')) {
    const sheet = child(pageEl, 'PageSheet');
    const rel = child(pageEl, 'Rel');
    const relId = rel ? attr(rel, 'r:id') ?? attr(rel, 'id') : undefined;
    const target = relId ? pageRels.get(relId) : undefined;
    const contents = target ? xml(`visio/pages/${target}`) : undefined;
    if (!contents) continue;
    const cells = sheet ? cellsOf(sheet) : new Map<string, string>();
    pages.push({
      name: attr(pageEl, 'Name') ?? attr(pageEl, 'NameU') ?? `Page ${pages.length + 1}`,
      width: num(cells.get('PageWidth'), 8.5),
      height: num(cells.get('PageHeight'), 11),
      shapes: children(child(contents, 'Shapes') ?? contents, 'Shape').map(readShape),
      connects: children(child(contents, 'Connects') ?? contents, 'Connect').map((c) => ({
        from: attr(c, 'FromSheet') ?? '',
        fromCell: attr(c, 'FromCell') ?? '',
        to: attr(c, 'ToSheet') ?? '',
      })),
    });
  }
  if (pages.length === 0) return { ok: false, format: 'vsdx', error: 'The drawing has no pages.' };

  const built = pages.map((page, index) => {
    const builder = new PageBuilder(page, masters, `p${index + 1}`, warnings);
    const result = builder.build();
    if (result.nodes.length === 0 && result.edges.length === 0) warnings.add('page.empty');
    return { name: page.name, ...result };
  });

  return {
    ok: true,
    format: 'vsdx',
    document: buildDocument(built, fileName),
    warnings: warnings.list(),
    stats: {
      pages: built.length,
      nodes: built.reduce((n, p) => n + p.nodes.filter((node) => node.type !== 'connection-anchor').length, 0),
      edges: built.reduce((n, p) => n + p.edges.length, 0),
    },
  };
}

// ── Package parts ───────────────────────────────────────────────────────

function readRels(rels: XmlElement | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!rels) return map;
  for (const rel of children(rels, 'Relationship')) {
    const id = attr(rel, 'Id');
    const target = attr(rel, 'Target');
    if (id && target) map.set(id, target.replace(/^\.?\//, ''));
  }
  return map;
}

function readMasters(xml: (path: string) => XmlElement | undefined): Map<string, MasterFile> {
  const out = new Map<string, MasterFile>();
  const index = xml('visio/masters/masters.xml');
  if (!index) return out;
  const rels = readRels(xml('visio/masters/_rels/masters.xml.rels'));
  for (const master of children(index, 'Master')) {
    const id = attr(master, 'ID');
    if (!id) continue;
    const rel = child(master, 'Rel');
    const relId = rel ? attr(rel, 'r:id') ?? attr(rel, 'id') : undefined;
    const target = relId ? rels.get(relId) : undefined;
    const contents = target ? xml(`visio/masters/${target}`) : undefined;
    const shapes = contents ? children(child(contents, 'Shapes') ?? contents, 'Shape').map(readShape) : [];
    const byId = new Map<string, VShape>();
    const index_ = (shape: VShape) => { byId.set(shape.id, shape); shape.children.forEach(index_); };
    shapes.forEach(index_);
    out.set(id, { name: attr(master, 'NameU') ?? attr(master, 'Name') ?? '', top: shapes[0], byId });
  }
  return out;
}

function readShape(element: XmlElement): VShape {
  const shape: VShape = {
    id: attr(element, 'ID') ?? '',
    name: attr(element, 'NameU') ?? attr(element, 'Name') ?? '',
    type: attr(element, 'Type') ?? 'Shape',
    masterId: attr(element, 'Master'),
    masterShapeId: attr(element, 'MasterShape'),
    cells: cellsOf(element),
    char: new Map(),
    para: new Map(),
    geometry: [],
    text: '',
    children: [],
  };
  for (const section of children(element, 'Section')) {
    const kind = attr(section, 'N');
    const firstRow = child(section, 'Row');
    if (kind === 'Character' && firstRow) shape.char = cellsOf(firstRow);
    else if (kind === 'Paragraph' && firstRow) shape.para = cellsOf(firstRow);
    else if (kind === 'Geometry' && attr(section, 'Del') !== '1' && cellsOf(section).get('NoShow') !== '1') {
      const rows = children(section, 'Row')
        .filter((row) => attr(row, 'Del') !== '1')
        .map((row) => {
          const c = cellsOf(row);
          return { type: attr(row, 'T') ?? '', x: num(c.get('X'), 0), y: num(c.get('Y'), 0) };
        })
        .filter((row) => row.type);
      shape.geometry.push({ rows, relative: rows.length > 0 && rows.every((r) => r.type.startsWith('Rel')) });
    }
  }
  const text = child(element, 'Text');
  if (text) shape.text = deepText(text).replace(/\n+$/, '');
  const nested = child(element, 'Shapes');
  if (nested) shape.children = children(nested, 'Shape').map(readShape);
  return shape;
}

function cellsOf(element: XmlElement): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of children(element, 'Cell')) {
    const n = attr(c, 'N');
    const v = attr(c, 'V');
    if (n && v !== undefined) map.set(n, v);
  }
  return map;
}

function num(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ── One page ────────────────────────────────────────────────────────────

class PageBuilder {
  private readonly nodes: DiagramNode[] = [];
  private readonly edges: DiagramEdge[] = [];
  private readonly rects = new Map<string, Rect>();
  private readonly connectorIds = new Set<string>();
  private readonly connectors: { shape: VShape; origin: Point }[] = [];
  private anchorCount = 0;

  constructor(
    private readonly page: VPage,
    private readonly masters: Map<string, MasterFile>,
    private readonly idPrefix: string,
    private readonly warnings: WarningSink,
  ) {
    for (const c of page.connects) this.connectorIds.add(c.from);
  }

  build(): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
    for (const shape of this.page.shapes) this.visit(shape, { x: 0, y: 0 }, undefined);
    for (const { shape, origin } of this.connectors) this.emitConnector(shape, origin);
    return { nodes: this.nodes, edges: this.edges };
  }

  // ── Inheritance ──

  private resolveMaster(shape: VShape, parentMaster: MasterFile | undefined): MasterFile | undefined {
    const file = shape.masterId ? this.masters.get(shape.masterId) : parentMaster;
    if (!file) return undefined;
    const inherited = shape.masterShapeId ? file.byId.get(shape.masterShapeId) : shape.masterId ? file.top : undefined;
    if (inherited) shape.master = inherited;
    return file;
  }

  private cell(shape: VShape, name: string): string | undefined {
    return shape.cells.get(name) ?? shape.master?.cells.get(name);
  }

  private charCell(shape: VShape, name: string): string | undefined {
    return shape.char.get(name) ?? shape.master?.char.get(name);
  }

  private geometryOf(shape: VShape): { sections: GeometrySection[]; width: number; height: number } {
    if (shape.geometry.length) {
      return { sections: shape.geometry, width: num(shape.cells.get('Width'), 1), height: num(shape.cells.get('Height'), 1) };
    }
    const master = shape.master;
    if (master?.geometry.length) {
      return { sections: master.geometry, width: num(master.cells.get('Width'), 1), height: num(master.cells.get('Height'), 1) };
    }
    return { sections: [], width: 1, height: 1 };
  }

  // ── Coordinates ──

  /** Bottom-left corner of the shape's box in page inches (y up). */
  private cornerOf(shape: VShape, origin: Point): { left: number; bottom: number; width: number; height: number } {
    const width = num(this.cell(shape, 'Width'), 0);
    const height = num(this.cell(shape, 'Height'), 0);
    const pinX = num(this.cell(shape, 'PinX'), 0);
    const pinY = num(this.cell(shape, 'PinY'), 0);
    const locPinX = num(this.cell(shape, 'LocPinX'), width / 2);
    const locPinY = num(this.cell(shape, 'LocPinY'), height / 2);
    return { left: origin.x + pinX - locPinX, bottom: origin.y + pinY - locPinY, width, height };
  }

  private toPx(inches: Point): Point {
    return { x: inches.x * PX_PER_INCH, y: (this.page.height - inches.y) * PX_PER_INCH };
  }

  private rectPx(box: { left: number; bottom: number; width: number; height: number }): Rect {
    const topLeft = this.toPx({ x: box.left, y: box.bottom + box.height });
    return { x: topLeft.x, y: topLeft.y, width: box.width * PX_PER_INCH, height: box.height * PX_PER_INCH };
  }

  // ── Shapes ──

  private visit(shape: VShape, origin: Point, parentMaster: MasterFile | undefined): void {
    const masterFile = this.resolveMaster(shape, parentMaster);
    const box = this.cornerOf(shape, origin);

    if (this.isConnector(shape, masterFile)) {
      this.connectors.push({ shape, origin });
      return;
    }
    if (shape.type === 'Foreign') {
      this.warnings.add('image.dropped');
      this.pushNode(shape, this.rectPx(box), 'RectangleNode');
      return;
    }

    const hasOwnOutline = shape.geometry.some(isOutline) || Boolean(shape.master?.geometry.some(isOutline));
    if (shape.type === 'Group') {
      // A group with its own outline is a real shape (Lucid and many stencils
      // draw the body on the group); the members are emitted on top of it.
      if (hasOwnOutline || shape.text) this.pushShape(shape, box, masterFile);
      else this.warnings.add('group.flattened');
      const childOrigin = { x: box.left, y: box.bottom };
      for (const c of shape.children) this.visit(c, childOrigin, masterFile);
      return;
    }
    if (!hasOwnOutline && !shape.text) return; // invisible helper shape
    this.pushShape(shape, box, masterFile);
  }

  private isConnector(shape: VShape, masterFile: MasterFile | undefined): boolean {
    if (this.connectorIds.has(shape.id)) return true;
    const oneDimensional = this.cell(shape, 'BeginX') !== undefined && this.cell(shape, 'EndX') !== undefined;
    if (!oneDimensional) return false;
    const name = `${shape.name} ${masterFile?.name ?? ''}`.toLowerCase();
    return /connector|line|arrow/.test(name) || num(this.cell(shape, 'Height'), 0) < 0.01;
  }

  private pushShape(shape: VShape, box: { left: number; bottom: number; width: number; height: number }, masterFile: MasterFile | undefined): void {
    const rect = this.rectPx(box);
    const names = [shape.name, masterFile?.name ?? '', shape.master?.name ?? ''];
    const byName = matchName(names);
    let type = byName?.type;
    let approximate = byName?.approximate ?? false;
    if (!type) {
      const { sections, width, height } = this.geometryOf(shape);
      const rounded = num(this.cell(shape, 'Rounding'), 0) > 0;
      const match = classifyGeometry(sections, width, height, rounded);
      if (match) {
        type = match.type;
        approximate = match.approximate;
      } else if (sections.length === 0 && shape.text) {
        type = 'TextNode';
      }
    }
    if (!type) {
      const label = names.find(Boolean)?.replace(/\.\d+$/, '') || 'shape';
      this.warnings.add('shape.unsupported', `Visio ${label}`);
      type = 'RectangleNode';
    } else if (approximate) {
      this.warnings.add('shape.approximated', `Visio ${names.find(Boolean)?.replace(/\.\d+$/, '') || type}`);
    }
    this.pushNode(shape, rect, type);
  }

  private pushNode(shape: VShape, rect: Rect, type: string): void {
    const style = this.nodeStyle(shape);
    if (type === 'TextNode') {
      delete style.fillColor;
      delete style.borderColor;
    }
    const id = `${this.idPrefix}-${shape.id}`;
    const { text, hadMarkup } = htmlToText(shape.text);
    if (hadMarkup) this.warnings.add('text.formatting-dropped', 'HTML');
    const zIndex = shape.type === 'Group' && shape.children.length ? -1 : undefined;
    this.nodes.push(buildNode({ id, type, ...rect, label: text, style, ...(zIndex === undefined ? {} : { zIndex }) }));
    this.rects.set(shape.id, rect);
  }

  private nodeStyle(shape: VShape): NodeStyle {
    const style: NodeStyle = {};
    const fillPattern = num(this.cell(shape, 'FillPattern'), 1);
    const fill = colorOf(this.cell(shape, 'FillForegnd'));
    if (fillPattern === 0) style.fillColor = 'transparent';
    else if (fill) style.fillColor = fill;

    const linePattern = num(this.cell(shape, 'LinePattern'), 1);
    const line = colorOf(this.cell(shape, 'LineColor'));
    if (linePattern === 0) style.borderColor = 'transparent';
    else if (line) style.borderColor = line;
    const weight = this.cell(shape, 'LineWeight');
    if (weight !== undefined) style.borderWidth = round(Math.max(0.5, num(weight, 0.01) * PX_PER_INCH));

    const color = colorOf(this.charCell(shape, 'Color'));
    if (color) style.textColor = color;
    const size = this.charCell(shape, 'Size');
    if (size !== undefined) style.fontSize = Math.round(num(size, 0.1111) * PX_PER_INCH);
    const bits = num(this.charCell(shape, 'Style'), 0);
    if (bits & 1) style.bold = true;
    if (bits & 2) style.italic = true;
    if (bits & 4) style.underline = true;
    const align = shape.para.get('HorzAlign') ?? shape.master?.para.get('HorzAlign');
    const aligns: TextAlign[] = ['left', 'center', 'right'];
    if (align !== undefined && aligns[num(align, 1)]) style.textAlign = aligns[num(align, 1)]!;

    const angle = num(this.cell(shape, 'Angle'), 0);
    if (Math.abs(angle) > 1e-6) style.rotation = round(-angle * (180 / Math.PI));
    return style;
  }

  // ── Connectors ──

  private emitConnector(shape: VShape, origin: Point): void {
    const begin = this.toPx({ x: origin.x + num(this.cell(shape, 'BeginX'), NaN), y: origin.y + num(this.cell(shape, 'BeginY'), NaN) });
    const end = this.toPx({ x: origin.x + num(this.cell(shape, 'EndX'), NaN), y: origin.y + num(this.cell(shape, 'EndY'), NaN) });
    if (![begin.x, begin.y, end.x, end.y].every(Number.isFinite)) {
      this.warnings.add('edge.skipped');
      return;
    }

    const glue = { begin: undefined as string | undefined, end: undefined as string | undefined };
    for (const c of this.page.connects) {
      if (c.from !== shape.id) continue;
      if (c.fromCell === 'BeginX') glue.begin = c.to;
      else if (c.fromCell === 'EndX') glue.end = c.to;
    }

    const bends = this.bendsOf(shape, origin);
    const { source, sourceHandle } = this.endpoint(glue.begin, begin, bends[0] ?? end);
    const { source: target, sourceHandle: targetHandle } = this.endpoint(glue.end, end, bends[bends.length - 1] ?? begin);

    let routing: Routing = bends.length ? 'orthogonal' : 'straight';
    const curved = shape.geometry.some((s) => s.rows.some((r) => /(ArcTo|NURBSTo|Spline)/.test(r.type)));
    if (curved) {
      routing = bends.length ? 'orthogonal' : 'curved';
      this.warnings.add('edge.curve-approximated');
    }

    const label = htmlToText(shape.text).text;
    const linePattern = num(this.cell(shape, 'LinePattern'), 1);
    const strokeColor = colorOf(this.cell(shape, 'LineColor'));
    const weight = this.cell(shape, 'LineWeight');
    this.edges.push(buildEdge({
      id: `${this.idPrefix}-${shape.id}`,
      source,
      target,
      sourceHandle,
      targetHandle,
      bendPoints: bends,
      labels: label ? [{ text: label, t: 0.5 }] : [],
      markerStart: markerOf(numOrUndefined(this.cell(shape, 'BeginArrow'))),
      markerEnd: markerOf(numOrUndefined(this.cell(shape, 'EndArrow'))),
      lineStyle: lineStyleOf(linePattern),
      routing,
      ...(weight !== undefined ? { strokeWidth: round(Math.max(0.5, num(weight, 0.01) * PX_PER_INCH)) } : {}),
      ...(strokeColor ? { strokeColor } : {}),
    }));
  }

  private endpoint(gluedTo: string | undefined, point: Point, toward: Point): { source: string; sourceHandle: HandleId | typeof ANCHOR_HANDLE_ID } {
    const rect = gluedTo ? this.rects.get(gluedTo) : undefined;
    if (rect && gluedTo) {
      return { source: `${this.idPrefix}-${gluedTo}`, sourceHandle: sideOf(rect, point) ?? pickHandle(rect, toward) };
    }
    this.warnings.add('edge.dangling');
    const id = `${this.idPrefix}-anchor-${++this.anchorCount}`;
    this.nodes.push(buildAnchorNode(id, point));
    return { source: id, sourceHandle: ANCHOR_HANDLE_ID };
  }

  /** Interior vertices of the connector's path, in page pixels. */
  private bendsOf(shape: VShape, origin: Point): Point[] {
    const section = shape.geometry.find((s) => s.rows.length > 2);
    if (!section) return [];
    const width = num(this.cell(shape, 'Width'), 0);
    const height = num(this.cell(shape, 'Height'), 0);
    const pinX = num(this.cell(shape, 'PinX'), 0);
    const pinY = num(this.cell(shape, 'PinY'), 0);
    const locPinX = num(this.cell(shape, 'LocPinX'), width / 2);
    const locPinY = num(this.cell(shape, 'LocPinY'), height / 2);
    const angle = num(this.cell(shape, 'Angle'), 0);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rows = section.rows.filter((r) => /(MoveTo|LineTo)$/.test(r.type));
    const points = rows.slice(1, -1).map((row) => {
      const lx = section.relative ? row.x * width : row.x;
      const ly = section.relative ? row.y * height : row.y;
      return this.toPx({
        x: origin.x + pinX - locPinX + lx * cos - ly * sin,
        y: origin.y + pinY - locPinY + lx * sin + ly * cos,
      });
    });
    return points.map((p) => ({ x: round(p.x), y: round(p.y) }));
  }
}

/**
 * The side a glue point sits on, when it sits on one. A connector glued to a
 * shape's centre (`ToCell="PinX"`) reports the centre instead, and then the
 * side facing the next bend is the better guess.
 */
function sideOf(rect: Rect, point: Point): HandleId | undefined {
  const slack = Math.max(2, Math.min(rect.width, rect.height) * 0.08);
  const distances: [HandleId, number][] = [
    ['top', Math.abs(point.y - rect.y)],
    ['bottom', Math.abs(point.y - (rect.y + rect.height))],
    ['left', Math.abs(point.x - rect.x)],
    ['right', Math.abs(point.x - (rect.x + rect.width))],
  ];
  const [side, distance] = distances.reduce((best, next) => (next[1] < best[1] ? next : best));
  return distance <= slack ? side : undefined;
}

// ── Names, colours, patterns ────────────────────────────────────────────

const NAME_RULES: [RegExp, string, boolean][] = [
  [/predefined process|subprocess|sub-process/, 'PredefinedProcessNode', false],
  [/manual input/, 'ManualInputNode', false],
  [/manual operation/, 'ManualOperationNode', false],
  [/internal storage/, 'InternalStorageNode', false],
  [/stored data|direct data|sequential data/, 'StoredDataNode', false],
  [/off-page|off page/, 'OffPageConnectorNode', false],
  [/on-page|on page/, 'OnPageConnectorNode', false],
  [/multiple document|multi-document/, 'MultipleDocumentsNode', false],
  [/^document/, 'DocumentNode', false],
  [/decision/, 'DecisionNode', false],
  [/start\/end|terminator|^start$|^end$/, 'TerminatorNode', false],
  [/^process/, 'ProcessNode', false],
  [/database|data store|cylinder|magnetic disk/, 'DatabaseNode', false],
  [/^data$|parallelogram|input\/output/, 'DataNode', false],
  [/preparation/, 'PreparationNode', false],
  [/display/, 'DisplayNode', false],
  [/delay/, 'DelayNode', false],
  [/^sort/, 'SortNode', false],
  [/merge|storage/, 'MergeNode', true],
  [/annotation|callout|comment|note/, 'AnnotationNode', true],
  [/actor|stick figure|person|user/, 'ActorNode', false],
  [/use case/, 'UmlUseCaseNode', false],
  [/lifeline/, 'UmlLifelineNode', false],
  [/package/, 'UmlPackageNode', false],
  [/component/, 'UmlComponentNode', false],
  [/state/, 'UmlStateNode', true],
  [/initial/, 'UmlInitialNode', false],
  [/final/, 'UmlFinalNode', false],
  [/fork|join/, 'UmlForkJoinNode', false],
  [/cloud/, 'EllipseNode', true],
  [/router|firewall|switch|hub|server|laptop|pc|desktop|workstation|computer|printer/, 'RectangleNode', true],
  [/entity|table/, 'EntityNode', true],
  [/rounded rectangle|rounded rect/, 'RoundedRectangleNode', false],
  [/rectangle|^box$|square/, 'RectangleNode', false],
  [/circle/, 'CircleNode', false],
  [/ellipse|oval/, 'EllipseNode', false],
  [/diamond|rhombus/, 'DiamondNode', false],
  [/triangle/, 'TriangleNode', false],
  [/hexagon/, 'PolygonNode', false],
  [/octagon/, 'OctagonNode', false],
  [/pentagon/, 'PentagonNode', false],
  [/star/, 'StarNode', false],
  [/chevron/, 'ChevronNode', false],
  [/^text|text block|caption/, 'TextNode', false],
];

function matchName(names: string[]): { type: string; approximate: boolean } | null {
  for (const raw of names) {
    const name = raw.replace(/\.\d+$/, '').trim().toLowerCase();
    if (!name) continue;
    for (const [pattern, type, approximate] of NAME_RULES) {
      if (pattern.test(name)) return { type, approximate };
    }
  }
  return null;
}

/** Visio's legacy indexed palette, still written by some exporters. */
const INDEXED_COLORS = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
  '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#c0c0c0', '#e6e6e6',
  '#cdcdcd', '#b3b3b3', '#9a9a9a', '#808080', '#666666', '#4d4d4d', '#333333', '#1a1a1a',
];

function colorOf(value: string | undefined): string | undefined {
  if (!value || value === 'Themed') return undefined;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  if (/^\d+$/.test(value)) return INDEXED_COLORS[Number(value)];
  return undefined;
}

function lineStyleOf(pattern: number): LineStyle {
  if (pattern === 1) return 'solid';
  if (pattern === 3 || pattern === 10 || pattern === 17 || pattern === 18) return 'dotted';
  if (pattern === 0) return 'solid';
  return 'dashed';
}

function numOrUndefined(value: string | undefined): number | undefined {
  return value === undefined ? undefined : num(value, NaN);
}
