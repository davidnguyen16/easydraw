import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { importDrawio, decompressDiagram } from './index.js';
import { detectFormat, importDiagram } from '../index.js';
import type { DiagramEdge, DiagramNode } from '@easydraw/diagram-schema';

/** Packs a model exactly as draw.io does: URI-encode → raw deflate → base64. */
function pack(xml: string): string {
  return deflateRawSync(Buffer.from(encodeURIComponent(xml), 'utf8')).toString('base64');
}

const PACKED_PAGE = pack(
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="only" value="Packed" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">' +
  '<mxGeometry x="10" y="20" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel>',
);

const FILE = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" agent="test" version="24.7.5">
  <diagram id="d1" name="Flow">
    <mxGraphModel dx="1" dy="1" grid="1" pageWidth="827" pageHeight="1169">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="start" value="Start" style="ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
          <mxGeometry x="100" y="40" width="80" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="proc" value="&lt;b&gt;Validate&lt;/b&gt;&lt;br&gt;input" style="rounded=1;whiteSpace=wrap;html=1;fontStyle=1;fontSize=16;align=left;" vertex="1" parent="1">
          <mxGeometry x="60" y="180" width="160" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="dec" value="OK?" style="rhombus;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="100" y="300" width="80" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="start" target="proc">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e2" value="yes" style="edgeStyle=orthogonalEdgeStyle;html=1;endArrow=block;endFill=0;dashed=1;strokeColor=#FF0000;exitX=1;exitY=0.5;entryX=0.5;entryY=0;" edge="1" parent="1" source="dec" target="proc">
          <mxGeometry relative="1" as="geometry">
            <Array as="points"><mxPoint x="300" y="340"/><mxPoint x="300" y="160"/></Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="e2l" value="no" style="edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];" vertex="1" connectable="0" parent="e2">
          <mxGeometry x="0.5" relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e3" style="html=1;endArrow=none;" edge="1" parent="1" source="dec">
          <mxGeometry relative="1" as="geometry"><mxPoint x="400" y="500" as="targetPoint"/></mxGeometry>
        </mxCell>
        <mxCell id="grp" value="" style="group" vertex="1" connectable="0" parent="1">
          <mxGeometry x="500" y="40" width="200" height="120" as="geometry"/>
        </mxCell>
        <mxCell id="g1" value="In group" style="whiteSpace=wrap;html=1;" vertex="1" parent="grp">
          <mxGeometry x="20" y="30" width="100" height="40" as="geometry"/>
        </mxCell>
        <object label="Lambda fn" id="aws1">
          <mxCell style="shape=mxgraph.aws4.lambda;html=1;" vertex="1" parent="1">
            <mxGeometry x="500" y="300" width="78" height="78" as="geometry"/>
          </mxCell>
        </object>
        <mxCell id="tbl" value="Users" style="shape=table;startSize=30;container=1;collapsible=1;childLayout=tableLayout;" vertex="1" parent="1">
          <mxGeometry x="700" y="300" width="180" height="90" as="geometry"/>
        </mxCell>
        <mxCell id="r1" style="shape=tableRow;horizontal=0;startSize=0;" vertex="1" parent="tbl"><mxGeometry y="30" width="180" height="30" as="geometry"/></mxCell>
        <mxCell id="c11" value="PK" style="shape=partialRectangle;html=1;connectable=0;" vertex="1" parent="r1"><mxGeometry width="30" height="30" as="geometry"/></mxCell>
        <mxCell id="c12" value="id" style="shape=partialRectangle;html=1;connectable=0;" vertex="1" parent="r1"><mxGeometry x="30" width="150" height="30" as="geometry"/></mxCell>
        <mxCell id="r2" style="shape=tableRow;horizontal=0;startSize=0;" vertex="1" parent="tbl"><mxGeometry y="60" width="180" height="30" as="geometry"/></mxCell>
        <mxCell id="c21" value="" style="shape=partialRectangle;html=1;connectable=0;" vertex="1" parent="r2"><mxGeometry width="30" height="30" as="geometry"/></mxCell>
        <mxCell id="c22" value="email" style="shape=partialRectangle;html=1;connectable=0;" vertex="1" parent="r2"><mxGeometry x="30" width="150" height="30" as="geometry"/></mxCell>
        <mxCell id="e4" style="edgeStyle=entityRelationEdgeStyle;endArrow=ERmany;startArrow=ERone;" edge="1" parent="1" source="c12" target="dec">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="txt" value="Just text" style="text;html=1;align=center;" vertex="1" parent="1">
          <mxGeometry x="60" y="440" width="120" height="30" as="geometry"/>
        </mxCell>
        <mxCell id="fc" value="Store" style="shape=mxgraph.flowchart.database;" vertex="1" parent="1">
          <mxGeometry x="300" y="440" width="80" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="lane" value="Pool" style="swimlane;html=1;container=1;" vertex="1" parent="1">
          <mxGeometry x="700" y="40" width="200" height="200" as="geometry"/>
        </mxCell>
        <mxCell id="inlane" value="Task" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="lane">
          <mxGeometry x="20" y="60" width="100" height="40" as="geometry"/>
        </mxCell>
        <mxCell id="tri" value="" style="triangle;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="400" y="40" width="60" height="80" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
  <diagram id="d2" name="Packed">${PACKED_PAGE}</diagram>
</mxfile>`;

function run() {
  const result = importDrawio(FILE, 'sample');
  assert.equal(result.ok, true, result.ok ? '' : result.error);
  if (!result.ok) throw new Error('unreachable');
  return result;
}

function node(nodes: DiagramNode[], id: string): DiagramNode {
  const found = nodes.find((n) => n.id === id);
  assert.ok(found, `node ${id} missing; have ${nodes.map((n) => n.id).join(', ')}`);
  return found;
}

function edge(edges: DiagramEdge[], id: string): DiagramEdge {
  const found = edges.find((e) => e.id === id);
  assert.ok(found, `edge ${id} missing`);
  return found;
}

describe('draw.io import', () => {
  it('detects the format from content, not the extension', () => {
    assert.equal(detectFormat(FILE), 'drawio');
    assert.equal(detectFormat('<mxGraphModel><root/></mxGraphModel>'), 'drawio');
    assert.equal(detectFormat('<?xml version="1.0"?><easydraw><state><![CDATA[{}]]></state></easydraw>'), 'easydraw');
    assert.equal(detectFormat('<VisioDocument xmlns="x"/>'), 'vdx');
    assert.equal(detectFormat('hello'), 'unknown');
  });

  it('produces a document the editor can load, one page per <diagram>', () => {
    const { document, stats } = run();
    assert.equal(document.schemaVersion, 1);
    assert.equal(document.fileName, 'sample');
    assert.equal(document.pages.length, 2);
    assert.deepEqual(document.pages.map((p) => p.name), ['Flow', 'Packed']);
    assert.equal(document.activePageId, document.pages[0]!.id);
    assert.equal(stats.pages, 2);
  });

  it('maps basic shapes, keeps geometry, colours and text style', () => {
    const { document } = run();
    const nodes = document.pages[0]!.nodes;

    const start = node(nodes, 'p1-start');
    assert.equal(start.type, 'CircleNode');
    assert.deepEqual(start.position, { x: 100, y: 40 });
    assert.equal(start.width, 80);
    assert.equal(start.data?.fillColor, '#dae8fc');
    assert.equal(start.data?.borderColor, '#6c8ebf');

    const proc = node(nodes, 'p1-proc');
    assert.equal(proc.type, 'RoundedRectangleNode');
    assert.equal(proc.data?.label, 'Validate\ninput');
    assert.equal(proc.data?.bold, true);
    assert.equal(proc.data?.fontSize, 16);
    assert.equal(proc.data?.textAlign, 'left');

    assert.equal(node(nodes, 'p1-dec').type, 'DiamondNode');
    assert.equal(node(nodes, 'p1-txt').type, 'TextNode');
    assert.equal(node(nodes, 'p1-fc').type, 'DatabaseNode');

    const tri = node(nodes, 'p1-tri');
    assert.equal(tri.type, 'TriangleNode');
    assert.equal(tri.data?.rotation, 90, 'draw.io triangles point east by default');
  });

  it('resolves group and container children to page coordinates', () => {
    const { document, warnings } = run();
    const nodes = document.pages[0]!.nodes;
    assert.deepEqual(node(nodes, 'p1-g1').position, { x: 520, y: 70 });
    assert.equal(nodes.some((n) => n.id === 'p1-grp'), false, 'a bare group is not a shape');

    const lane = node(nodes, 'p1-lane');
    assert.equal(lane.type, 'RectangleNode');
    assert.equal(lane.zIndex, -1);
    assert.equal(lane.data?.label, '', 'the title moves to its own text node on the header strip');
    const title = node(nodes, 'p1-lane-title');
    assert.equal(title.type, 'TextNode');
    assert.equal(title.data?.label, 'Pool');
    assert.deepEqual(title.position, { x: 700, y: 40 });
    assert.equal(title.height, 23, 'draw.io default startSize');
    assert.deepEqual(node(nodes, 'p1-inlane').position, { x: 720, y: 100 });

    const group = warnings.find((w) => w.code === 'group.flattened');
    assert.equal(group?.count, 1);
    assert.equal(group?.message, '1 group was flattened; its members are now individual objects.');
    assert.ok(warnings.some((w) => w.code === 'container.flattened' && w.count === 1));
  });

  it('turns an ER table into an entity with one field per row', () => {
    const { document } = run();
    const nodes = document.pages[0]!.nodes;
    const users = node(nodes, 'p1-tbl');
    assert.equal(users.type, 'EntityNode');
    assert.equal(users.data?.label, 'Users');
    assert.deepEqual(users.data?.fields, [{ name: 'PK id' }, { name: 'email' }]);
    assert.equal(users.height, undefined, 'entities grow to fit their rows');
    assert.equal(nodes.some((n) => n.id === 'p1-r1' || n.id === 'p1-c12'), false, 'rows are absorbed');
  });

  it('keeps unknown stencils as labelled rectangles and reports them once per kind', () => {
    const { document, warnings } = run();
    const lambda = node(document.pages[0]!.nodes, 'p1-aws1');
    assert.equal(lambda.type, 'RectangleNode');
    assert.equal(lambda.data?.label, 'Lambda fn', 'label comes from the <object> wrapper');
    const warning = warnings.find((w) => w.code === 'shape.unsupported');
    assert.ok(warning);
    assert.match(warning.message, /mxgraph\.aws4\.lambda/);
  });

  it('connects edges to the right sides with draw.io defaults and constraints', () => {
    const { document } = run();
    const edges = document.pages[0]!.edges;

    const e1 = edge(edges, 'p1-e1');
    assert.equal(e1.source, 'p1-start');
    assert.equal(e1.target, 'p1-proc');
    assert.equal(e1.sourceHandle, 'bottom');
    assert.equal(e1.targetHandle, 'top');
    assert.equal(e1.data?.markerEnd, 'triangle', 'draw.io draws a filled arrow when endArrow is absent');
    assert.equal(e1.data?.markerStart, 'none');
    assert.equal(e1.data?.routing, 'orthogonal');

    const e2 = edge(edges, 'p1-e2');
    assert.equal(e2.sourceHandle, 'right', 'exitX=1');
    assert.equal(e2.targetHandle, 'top', 'entryY=0');
    assert.equal(e2.data?.markerEnd, 'triangle-open', 'block + endFill=0');
    assert.equal(e2.data?.lineStyle, 'dashed');
    assert.equal(e2.data?.strokeColor, '#ff0000');
    assert.deepEqual(e2.data?.bendPoints, [{ x: 300, y: 340 }, { x: 300, y: 160 }]);
    assert.deepEqual(
      (e2.data?.labels as { text: string; t: number }[]).map((l) => [l.text, l.t]),
      [['yes', 0.5], ['no', 0.75]],
    );

    const e4 = edge(edges, 'p1-e4');
    assert.equal(e4.source, 'p1-tbl', 'an edge on an absorbed table cell attaches to the table');
    assert.equal(e4.data?.markerStart, 'bar');
    assert.equal(e4.data?.markerEnd, 'crowfoot');
  });

  it('gives a free edge end a floating anchor instead of dropping the edge', () => {
    const { document, warnings } = run();
    const page = document.pages[0]!;
    const e3 = edge(page.edges, 'p1-e3');
    assert.equal(e3.source, 'p1-dec');
    const anchor = node(page.nodes, e3.target);
    assert.equal(anchor.type, 'connection-anchor');
    assert.deepEqual(anchor.position, { x: 400, y: 500 });
    assert.equal(e3.targetHandle, 'a');
    assert.equal(e3.data?.markerEnd, 'none');
    assert.equal(e3.data?.routing, 'straight');
    assert.ok(warnings.some((w) => w.code === 'edge.dangling' && w.count === 1));
  });

  it('inflates compressed pages', () => {
    const { document } = run();
    const packed = document.pages[1]!;
    assert.equal(packed.nodes.length, 1);
    assert.equal(packed.nodes[0]!.data?.label, 'Packed');
    assert.match(decompressDiagram(PACKED_PAGE), /^<mxGraphModel>/);
  });

  it('reports rich text that was flattened, once', () => {
    const { warnings } = run();
    const w = warnings.find((x) => x.code === 'text.formatting-dropped');
    assert.ok(w);
    assert.equal(w.count, 1);
  });

  it('rejects files that are not draw.io with a reason', () => {
    const notXml = importDrawio('<mxfile><diagram', 'x');
    assert.equal(notXml.ok, false);
    if (!notXml.ok) assert.match(notXml.error, /well-formed/);
    const wrongRoot = importDrawio('<svg/>', 'x');
    assert.equal(wrongRoot.ok, false);
    if (!wrongRoot.ok) assert.match(wrongRoot.error, /<svg>/);
  });

  it('goes through the generic entry point from bytes', () => {
    const result = importDiagram(new TextEncoder().encode(FILE), 'diagram.drawio');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.document.fileName, 'diagram');
    const unknown = importDiagram(new TextEncoder().encode('plain text'), 'notes.txt');
    assert.equal(unknown.ok, false);
    if (!unknown.ok) assert.match(unknown.error, /draw\.io/);
  });
});
