import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import { importVsdx } from './index.js';
import { detectFormat, importDiagram } from '../index.js';
import type { DiagramEdge, DiagramNode } from '@easydraw/diagram-schema';

const NS = 'xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const RELS_NS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';

const RECT_GEOMETRY = `
  <Section N="Geometry" IX="0">
    <Row T="RelMoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
    <Row T="RelLineTo" IX="2"><Cell N="X" V="1"/><Cell N="Y" V="0"/></Row>
    <Row T="RelLineTo" IX="3"><Cell N="X" V="1"/><Cell N="Y" V="1"/></Row>
    <Row T="RelLineTo" IX="4"><Cell N="X" V="0"/><Cell N="Y" V="1"/></Row>
    <Row T="RelLineTo" IX="5"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
  </Section>`;

const PAGE = `<?xml version="1.0" encoding="utf-8"?>
<PageContents ${NS}>
  <Shapes>
    <Shape ID="1" NameU="Process.1" Name="Process.1" Type="Shape" Master="2">
      <Cell N="PinX" V="2"/><Cell N="PinY" V="9"/><Cell N="Width" V="2"/><Cell N="Height" V="1"/>
      <Cell N="LocPinX" V="1" F="Width*0.5"/><Cell N="LocPinY" V="0.5" F="Height*0.5"/>
      <Cell N="FillForegnd" V="#dae8fc"/><Cell N="LineColor" V="#6c8ebf"/><Cell N="LineWeight" V="0.02"/>
      <Section N="Character"><Row IX="0"><Cell N="Color" V="#000000"/><Cell N="Size" V="0.1666667" U="PT"/><Cell N="Style" V="1"/></Row></Section>
      <Text><cp IX="0"/>Validate input</Text>
    </Shape>
    <Shape ID="2" NameU="Sheet.2" Name="Sheet.2" Type="Shape">
      <Cell N="PinX" V="2"/><Cell N="PinY" V="6"/><Cell N="Width" V="1"/><Cell N="Height" V="1"/><Cell N="LocPinX" V="0.5"/><Cell N="LocPinY" V="0.5"/>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0.5"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="1"/><Cell N="Y" V="0.5"/></Row>
        <Row T="LineTo" IX="3"><Cell N="X" V="0.5"/><Cell N="Y" V="1"/></Row>
        <Row T="LineTo" IX="4"><Cell N="X" V="0"/><Cell N="Y" V="0.5"/></Row>
        <Row T="LineTo" IX="5"><Cell N="X" V="0.5"/><Cell N="Y" V="0"/></Row>
      </Section>
      <Text>OK?</Text>
    </Shape>
    <Shape ID="3" NameU="Sheet.3" Name="Sheet.3" Type="Shape">
      <Cell N="PinX" V="5"/><Cell N="PinY" V="9"/><Cell N="Width" V="1"/><Cell N="Height" V="1"/><Cell N="LocPinX" V="0.5"/><Cell N="LocPinY" V="0.5"/>
      <Cell N="FillPattern" V="0"/>
      <Section N="Geometry" IX="0"><Row T="Ellipse" IX="1"><Cell N="X" V="0.5"/><Cell N="Y" V="0.5"/><Cell N="A" V="1"/><Cell N="B" V="0.5"/><Cell N="C" V="0.5"/><Cell N="D" V="1"/></Row></Section>
      <Text>Start</Text>
    </Shape>
    <Shape ID="4" NameU="Dynamic connector" Name="Dynamic connector" Type="Shape">
      <Cell N="BeginX" V="3"/><Cell N="BeginY" V="9"/><Cell N="EndX" V="2"/><Cell N="EndY" V="6.5"/>
      <Cell N="PinX" V="3"/><Cell N="PinY" V="9"/><Cell N="Width" V="1"/><Cell N="Height" V="0"/><Cell N="LocPinX" V="0"/><Cell N="LocPinY" V="0"/><Cell N="Angle" V="0"/>
      <Cell N="EndArrow" V="13"/><Cell N="LinePattern" V="2"/>
      <Section N="Geometry" IX="0">
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="0.5"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="3"><Cell N="X" V="0.5"/><Cell N="Y" V="-2.5"/></Row>
        <Row T="LineTo" IX="4"><Cell N="X" V="-1"/><Cell N="Y" V="-2.5"/></Row>
      </Section>
      <Text>next</Text>
    </Shape>
    <Shape ID="6" NameU="Dynamic connector.6" Name="Dynamic connector.6" Type="Shape">
      <Cell N="BeginX" V="6"/><Cell N="BeginY" V="9"/><Cell N="EndX" V="7"/><Cell N="EndY" V="8"/>
      <Cell N="PinX" V="6.5"/><Cell N="PinY" V="8.5"/><Cell N="Width" V="1.4142"/><Cell N="Height" V="0"/>
      <Cell N="BeginArrow" V="10"/><Cell N="EndArrow" V="0"/>
    </Shape>
    <Shape ID="7" NameU="Sheet.7" Name="Sheet.7" Type="Group">
      <Cell N="PinX" V="6"/><Cell N="PinY" V="3"/><Cell N="Width" V="2"/><Cell N="Height" V="1"/><Cell N="LocPinX" V="1"/><Cell N="LocPinY" V="0.5"/>
      <Shapes>
        <Shape ID="8" NameU="Sheet.8" Name="Sheet.8" Type="Shape">
          <Cell N="PinX" V="0.5"/><Cell N="PinY" V="0.5"/><Cell N="Width" V="1"/><Cell N="Height" V="0.5"/><Cell N="LocPinX" V="0.5"/><Cell N="LocPinY" V="0.25"/>
          ${RECT_GEOMETRY}
          <Text>Member</Text>
        </Shape>
      </Shapes>
    </Shape>
    <Shape ID="9" NameU="Sheet.9" Name="Sheet.9" Type="Shape">
      <Cell N="PinX" V="4"/><Cell N="PinY" V="2"/><Cell N="Width" V="2"/><Cell N="Height" V="0.5"/><Cell N="LocPinX" V="1"/><Cell N="LocPinY" V="0.25"/>
      <Text>Just text</Text>
    </Shape>
  </Shapes>
  <Connects>
    <Connect FromSheet="4" FromCell="BeginX" FromPart="9" ToSheet="1" ToCell="PinX" ToPart="3"/>
    <Connect FromSheet="4" FromCell="EndX" FromPart="12" ToSheet="2" ToCell="PinX" ToPart="3"/>
  </Connects>
</PageContents>`;

const MASTER = `<?xml version="1.0" encoding="utf-8"?>
<MasterContents ${NS}>
  <Shapes>
    <Shape ID="5" NameU="Process" Name="Process" Type="Shape">
      <Cell N="Width" V="1.5"/><Cell N="Height" V="0.75"/><Cell N="FillForegnd" V="#ffffff"/>
      ${RECT_GEOMETRY}
    </Shape>
  </Shapes>
</MasterContents>`;

function buildVsdx(): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'visio/document.xml': strToU8(`<VisioDocument ${NS}/>`),
    'visio/pages/pages.xml': strToU8(`<Pages ${NS}>
      <Page ID="0" NameU="Page-1" Name="Flow"><PageSheet><Cell N="PageWidth" V="8.5"/><Cell N="PageHeight" V="11"/></PageSheet><Rel r:id="rId1"/></Page>
    </Pages>`),
    'visio/pages/_rels/pages.xml.rels': strToU8(`<Relationships ${RELS_NS}><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/></Relationships>`),
    'visio/pages/page1.xml': strToU8(PAGE),
    'visio/masters/masters.xml': strToU8(`<Masters ${NS}><Master ID="2" NameU="Process" Name="Process"><Rel r:id="rId1"/></Master></Masters>`),
    'visio/masters/_rels/masters.xml.rels': strToU8(`<Relationships ${RELS_NS}><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/></Relationships>`),
    'visio/masters/master1.xml': strToU8(MASTER),
  });
}

function run() {
  const result = importVsdx(buildVsdx(), 'visio-sample');
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

describe('VSDX import', () => {
  it('is detected from the zip signature', () => {
    assert.equal(detectFormat(buildVsdx()), 'vsdx');
  });

  it('flips Visio inches (origin bottom-left) into pixels (origin top-left)', () => {
    const { document } = run();
    const proc = node(document.pages[0]!.nodes, 'p1-1');
    // left = PinX − LocPinX = 1in; top = 11 − (PinY − LocPinY + Height) = 1.5in
    assert.deepEqual(proc.position, { x: 96, y: 144 });
    assert.equal(proc.width, 192);
    assert.equal(proc.height, 96);
  });

  it('classifies shapes by master name, then by outline geometry', () => {
    const { document } = run();
    const nodes = document.pages[0]!.nodes;
    assert.equal(node(nodes, 'p1-1').type, 'ProcessNode', 'inherits the "Process" master');
    assert.equal(node(nodes, 'p1-2').type, 'DiamondNode', 'four edge-midpoint vertices');
    assert.equal(node(nodes, 'p1-3').type, 'CircleNode', 'Ellipse row on a square box');
    assert.equal(node(nodes, 'p1-8').type, 'RectangleNode');
    assert.equal(node(nodes, 'p1-9').type, 'TextNode', 'no outline, only text');
  });

  it('carries fill, line, font and text across', () => {
    const { document } = run();
    const nodes = document.pages[0]!.nodes;
    const proc = node(nodes, 'p1-1');
    assert.equal(proc.data?.label, 'Validate input');
    assert.equal(proc.data?.fillColor, '#dae8fc');
    assert.equal(proc.data?.borderColor, '#6c8ebf');
    assert.equal(proc.data?.borderWidth, 1.92);
    assert.equal(proc.data?.fontSize, 16, '12pt at 96dpi');
    assert.equal(proc.data?.bold, true);
    assert.equal(node(nodes, 'p1-3').data?.fillColor, 'transparent', 'FillPattern 0');
  });

  it('places group members in page space and flattens the group', () => {
    const { document, warnings } = run();
    const nodes = document.pages[0]!.nodes;
    const member = node(nodes, 'p1-8');
    // group box: left 5in, bottom 2.5in; member: left 5in, top 3.25in
    assert.deepEqual(member.position, { x: 480, y: 744 });
    assert.equal(nodes.some((n) => n.id === 'p1-7'), false);
    assert.ok(warnings.some((w) => w.code === 'group.flattened'));
  });

  it('turns glued connectors into edges with the elbow preserved', () => {
    const { document } = run();
    const e = edge(document.pages[0]!.edges, 'p1-4');
    assert.equal(e.source, 'p1-1');
    assert.equal(e.target, 'p1-2');
    assert.equal(e.sourceHandle, 'right', 'the begin point sits on the process\'s right edge');
    assert.equal(e.targetHandle, 'top', 'the end point sits on the diamond\'s top edge');
    assert.deepEqual(e.data?.bendPoints, [{ x: 336, y: 192 }, { x: 336, y: 432 }]);
    assert.equal(e.data?.routing, 'orthogonal');
    assert.equal(e.data?.markerEnd, 'triangle', 'Visio arrow 13');
    assert.equal(e.data?.lineStyle, 'dashed', 'LinePattern 2');
    assert.deepEqual(e.data?.labels, [{ id: 'p1-4-l1', t: 0.5, text: 'next' }]);
  });

  it('keeps an unglued connector as a floating line', () => {
    const { document, warnings } = run();
    const page = document.pages[0]!;
    const e = edge(page.edges, 'p1-6');
    assert.equal(node(page.nodes, e.source).type, 'connection-anchor');
    assert.equal(node(page.nodes, e.target).type, 'connection-anchor');
    assert.deepEqual(node(page.nodes, e.source).position, { x: 576, y: 192 });
    assert.equal(e.data?.markerStart, 'circle', 'Visio arrow 10');
    assert.equal(e.data?.markerEnd, 'none');
    assert.equal(e.data?.routing, 'straight');
    assert.equal(warnings.find((w) => w.code === 'edge.dangling')?.count, 2);
  });

  it('names the page and counts what landed', () => {
    const { document, stats } = run();
    assert.equal(document.pages[0]!.name, 'Flow');
    assert.deepEqual(stats, { pages: 1, nodes: 5, edges: 2 });
  });

  it('explains a zip that is not a drawing, and a VDX', () => {
    const zip = zipSync({ 'hello.txt': strToU8('hi') });
    const result = importVsdx(zip, 'x');
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /visio\/pages/);

    const vdx = importDiagram(new TextEncoder().encode('<VisioDocument xmlns="urn:schemas-microsoft-com:office:visio"/>'), 'old.vdx');
    assert.equal(vdx.ok, false);
    if (!vdx.ok) assert.match(vdx.error, /VSDX/);
  });
});
