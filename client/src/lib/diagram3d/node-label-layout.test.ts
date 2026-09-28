import { describe, expect, it } from 'vitest';
import type { DiagramSceneNode } from './scene-model';
import { getNodeLabelLayout, nodeLabelLayoutKey, type SurfaceText } from './node-label-layout';
import { getNodeVisualDefinition } from './visual-catalog';

function node(type = 'RectangleNode', data: Record<string, unknown> = { label: 'Example' }): DiagramSceneNode {
  return { id: 'internal-id', type, data, selected: false, locked: false, label: String(data.label ?? ''), details: [], kind: 'box', position: [9, 2, -3], rotation: [0, 0, 0], size: [2, 1, 1.4], color: '#ffffff', textColor: '#2c2c2a' };
}
const text = (subject: DiagramSceneNode) => getNodeLabelLayout(subject)?.commands.filter((command): command is SurfaceText => command.kind === 'text') ?? [];

describe('printed node labels', () => {
  it('never prints internal IDs or replaces explicitly empty labels', () => {
    for (const type of ['RectangleNode', 'TextNode', 'ActorNode', 'UmlInitialNode', 'UmlFinalNode', 'UmlForkJoinNode']) {
      expect(getNodeLabelLayout(node(type, { label: '' }))).toBeNull();
    }
    expect(getNodeLabelLayout(node('RectangleNode', {}))).toBeNull();
    expect(getNodeLabelLayout(node('TextNode', { label: ' \n ' }))).toBeNull();
  });

  it('keeps placement and cache stable across camera-independent transforms and selection', () => {
    const original = node();
    const before = JSON.stringify(original);
    const first = getNodeLabelLayout(original);
    const moved = getNodeLabelLayout({ ...original, position: [100, 200, -300], rotation: [2, 1, 3], selected: true });
    expect(nodeLabelLayoutKey(moved)).toBe(nodeLabelLayoutKey(first));
    expect(JSON.stringify(original)).toBe(before);
    expect(first?.position).toEqual([0, 0.401, 0]);
    expect(first?.commands).toHaveLength(1);
    expect(first?.commands[0].kind).toBe('text');
  });

  it('preserves font styling, multiline content, color and opacity', () => {
    const subject = node('RectangleNode', { label: 'Tiếng Việt\n第二行', fontFamily: 'Cousine', fontSize: 22, bold: true, italic: true, underline: true, textAlign: 'right', textColor: '#123456', opacity: 35 });
    expect(getNodeLabelLayout(subject)?.opacity).toBe(0.35);
    expect(text(subject)[0]).toMatchObject({ text: 'Tiếng Việt\n第二行', multiline: true, style: { fontFamily: 'Cousine', fontSize: 22, fontWeight: 700, italic: true, underline: true, align: 'right', color: '#123456' } });
  });

  it('maps UML header/tab/top-left layouts to the same 2D proportions', () => {
    const header = text(node('UmlLifelineNode'))[0];
    expect(header).toMatchObject({ x: 12, width: 176, height: 28 });
    expect(header.y).toBeCloseTo(1.4);
    const tab = text(node('UmlCombinedFragmentNode'))[0];
    expect(tab).toMatchObject({ x: 10, width: 38 });
    expect(tab.y).toBeCloseTo(3.4);
    expect(tab.height).toBeCloseTo(19.8);
    const left = text(node('UmlSystemBoundaryNode'))[0];
    expect(left).toMatchObject({ x: 10, width: 180, verticalAlign: 'top' });
    expect(left.y).toBeCloseTo(8.2);
  });

  it('uses physical surfaces for sphere/cylinder/cube and actor feet', () => {
    expect(getNodeLabelLayout(node('CircleNode'))).toMatchObject({ surface: 'sphere', clip: 'ellipse', position: [0, 0.501, 0] });
    expect(getNodeLabelLayout(node('DatabaseNode'))).toMatchObject({ surface: 'top', clip: 'ellipse', position: [0, 0.501, 0] });
    expect(getNodeLabelLayout(node('CubeNode'))).toMatchObject({ surface: 'top', clip: 'none', position: [0, 0.501, 0] });
    const actor = getNodeLabelLayout(node('ActorNode'))!;
    expect(actor.surface).toBe('front');
    expect(actor.position[1] + actor.height / 200).toBeCloseTo(-0.54);
    expect(actor.commands.every((command) => command.kind === 'text')).toBe(true);
  });

  it('keeps entity header styles separate from field rows and body fill', () => {
    const subject = node('EntityNode', { label: 'Accounts', fillColor: '#ffeeaa', fontSize: 20, bold: true, italic: true, underline: true, fontFamily: 'Cousine', textColor: '#123456', showDataTypes: true, fields: [{ name: 'id', type: 'uuid', isPK: true }, { name: 'owner', key: 'FK', optionalKey: 'PI' }] });
    const layout = getNodeLabelLayout(subject)!;
    expect(layout.clip).toBe('card');
    expect(layout.commands[0]).toMatchObject({ kind: 'rect', x: 0, y: 0, width: 200, height: 46, fill: '#ffeeaa' });
    const commands = text(subject);
    expect(commands[0]).toMatchObject({ text: 'Accounts', style: { fontSize: 20, fontWeight: 700, italic: true } });
    expect(commands.find((command) => command.text === 'id')).toMatchObject({ y: 55, style: { fontSize: 12, fontWeight: 500, italic: false, underline: false, color: '#123456' } });
    expect(commands.find((command) => command.text === 'UUID')).toMatchObject({ style: { fontSize: 11, align: 'right', color: '#888888' } });
    expect(commands.filter((command) => ['PK', 'FK', 'PI'].includes(command.text))).toHaveLength(3);
    expect(getNodeVisualDefinition('EntityNode', subject.data).svg).not.toContain('M1,23');
  });

  it('honors entity type toggle, legacy keys, empty title and bounded rows', () => {
    const subject = node('WeakEntityNode', { label: '', showDataTypes: false, fields: [{ name: 'id', type: 'uuid', isFK: true }] });
    expect(text(subject).map((command) => command.text)).toEqual(['', 'FK', 'id']);
    expect(getNodeVisualDefinition('WeakEntityNode').svg).toContain('x="5"');
    const many = node('EntityNode', { fields: Array.from({ length: 2000 }, () => ({ name: 'field' })) });
    expect(text(many).filter((command) => command.text === 'field').length).toBeLessThan(5);
  });

  it('bounds malformed fonts, opacity and overly long labels', () => {
    const subject = node('RectangleNode', { label: 'a'.repeat(30_000), fontSize: Infinity, textColor: 'var(--ink)', opacity: -4 });
    expect(text(subject)[0].text).toHaveLength(20_000);
    expect(text(subject)[0].style).toMatchObject({ fontSize: 14, color: '#2c2c2a' });
    expect(getNodeLabelLayout(subject)?.opacity).toBe(0);
  });
});
