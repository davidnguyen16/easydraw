import type { Edge, Node } from '@xyflow/react';
import { cloneVisual3DRecipe } from '@easydraw/diagram-schema';
import { getObject3D } from '@easydraw/objects-3d';
import type { EditorState } from '../../stores/editor-doc.store';

export const DATA_CENTRE_TITLE = 'Data Centre — Operations Campus';

/** Original, asset-free cutaway inspired by a physical data-centre floor plan.
 * All equipment is an ordinary editable CubeNode carrying a 3D recipe copied from
 * the @easydraw/objects-3d starter set — the same objects a user can drop from
 * their private library, so nothing in the sample is special.
 * Every call allocates an independent JSON document; no account, API or S3 writes.
 */
export function createDataCentreDocument(): EditorState {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const colors = {
    ink: '#22334a', rack: '#273545', teal: '#13a89e', blue: '#487ace',
    floor: '#f0f3f7', wall: '#dce3ea', amber: '#d99534',
  };

  function block(id: string, x: number, y: number, width: number, depth: number,
    height: number, fill: string, elevation = 0, extra: Record<string, unknown> = {}) {
    const node: Node = {
      id, type: 'CubeNode', position: { x, y }, width, height: depth,
      style: { width, height: depth },
      data: {
        label: '', fillColor: fill, borderColor: fill, borderWidth: 0,
        textColor: colors.ink, fontSize: 18,
        spatial3d: { depth: height, elevation }, ...extra,
      },
    };
    nodes.push(node);
    return node;
  }

  function equipment(id: string, kind: string, x: number, y: number,
    width: number, depth: number, height: number, label: string,
    fill = colors.rack, elevation = 0.025) {
    const object = getObject3D(kind);
    if (!object) throw new Error(`The data-centre sample needs the "${kind}" starter object.`);
    // The sample places every object at its own size and colour; drop defaults are not needed.
    const recipe = { version: 2 as const, parts: cloneVisual3DRecipe(object.recipe).parts };
    return block(id, x, y, width, depth, height, fill, elevation, {
      visual3d: recipe, label, textColor: '#f0f7fb', fontSize: 13,
      shadow: true,
    });
  }

  function ink(id: string, x: number, y: number, width: number, height: number,
    label: string, fontSize = 24, color = colors.ink, elevation = 0.04) {
    nodes.push({
      id, type: 'TextNode', position: { x, y }, width, height,
      style: { width, height },
      data: { label, fontSize, textColor: color, textAlign: 'left', bold: true,
        fillColor: 'transparent', borderWidth: 0,
        spatial3d: { depth: 0.02, elevation } },
    });
  }

  function link(id: string, source: string, target: string, color: string,
    bends: { x: number; y: number; z: number }[], sourceHandle = 'top', targetHandle = 'top') {
    edges.push({
      id, type: 'connection', source, target, sourceHandle, targetHandle,
      data: { routing: 'orthogonal', strokeColor: color, strokeWidth: 2,
        markerStart: 'none', markerEnd: 'none', bendPoints: bends },
    });
  }

  // The plinth, paving and partitions remain editable too. Negative zIndex only
  // controls the 2D canvas stacking; the 3D view uses their actual elevations.
  const backdrop = { zIndex: -10, data: { locked: true } };
  const foundation = block('foundation', -25, -25, 1850, 1550, 0.24, '#bbc7d3', -0.26);
  foundation.zIndex = backdrop.zIndex;
  foundation.data.locked = true;
  const zones = [
    ['floor-compute', 0, 0, 1200, 1040, '#eff3f7'],
    ['floor-services', 1220, 0, 580, 1040, '#e5edf4'],
    ['floor-operations', 0, 1060, 1800, 355, '#e8eef2'],
    ['floor-title', 0, 1425, 1800, 75, '#d5e0e9'],
  ] as const;
  for (const [id, x, y, w, d, fill] of zones) {
    const floor = block(id, x, y, w, d, 0.035, fill, -0.02);
    floor.zIndex = -9;
    floor.data.locked = true;
  }

  // Open front/right edges give an unobstructed cutaway, rather than a roof
  // hiding the equipment. Low internal partitions keep the three zones legible.
  block('wall-back', 0, -8, 1800, 18, 2.65, colors.wall);
  block('wall-left', -8, 10, 18, 1025, 2.65, colors.wall);
  block('wall-back-cap', 0, -8, 1800, 18, 0.035, '#8295a8', 2.65);
  block('wall-left-cap', -8, 10, 18, 1025, 0.035, '#8295a8', 2.65);
  block('partition-services-back', 1200, 15, 18, 325, 0.95, colors.wall);
  block('partition-services-front', 1200, 505, 18, 535, 0.95, colors.wall);
  block('partition-noc-left', 0, 1040, 250, 18, 0.8, colors.wall);
  block('partition-noc-right', 415, 1040, 790, 18, 0.8, colors.wall);
  block('room-edge-right', 1790, 10, 10, 1405, 0.14, '#a9bac8');

  ink('hall-title', 180, 155, 930, 65, '01 / COMPUTE HALL', 34);
  ink('service-title', 1250, 35, 500, 70, '02 / INFRASTRUCTURE', 25);
  ink('noc-title', 200, 1072, 1160, 65, '03 / NETWORK OPERATIONS CENTRE', 29);
  ink('campus-title', 160, 1423, 1100, 82, 'NORTHSTAR  /  DC–01', 44);
  ink('campus-subtitle', 1280, 1434, 450, 55, '24/7 OPERATIONS', 20, '#52697f');

  // Cooling air lanes are flush coloured floor strips, not floating labels.
  block('cold-aisle', 200, 455, 880, 112, 0.022, '#c7e9e9', 0.016);
  ink('cold-aisle-label', 365, 477, 600, 60, 'COLD AISLE  /  18–22°C', 26, '#247d80', 0.045);
  for (const [index, x] of [235, 640, 1020].entries()) {
    equipment(`cooling-${index + 1}`, 'cooling', x, 32, 86, 88, 1.85, `CRAC 0${index + 1}`, '#587286');
  }

  // Two rows of five racks; repeatable recipes are a single editable node each.
  for (const [row, y] of [['a', 290], ['b', 635]] as const) {
    for (let index = 0; index < 5; index++) {
      equipment(`rack-${row}-${String(index + 1).padStart(2, '0')}`, 'rack',
        225 + index * 174, y, 104, 112, 2.15,
        `${row.toUpperCase()}–${String(index + 1).padStart(2, '0')}`);
    }
  }
  ink('row-a-label', 62, 310, 150, 110, 'ROW A', 23, '#52697f');
  ink('row-b-label', 62, 655, 150, 110, 'ROW B', 23, '#52697f');

  // Independent service bay: redundant power, spine switches and storage.
  equipment('ups-a', 'ups', 1280, 150, 105, 110, 2.05, 'UPS A', '#485566');
  equipment('ups-b', 'ups', 1450, 150, 105, 110, 2.05, 'UPS B', '#485566');
  equipment('ups-c', 'ups', 1620, 150, 105, 110, 2.05, 'PDU', '#485566');
  block('network-plinth', 1285, 360, 465, 142, 0.42, '#becdd8', 0.02);
  equipment('spine-a', 'switch', 1310, 373, 160, 110, 0.43, 'SPINE A', '#334b60', 0.44);
  equipment('spine-b', 'switch', 1555, 373, 160, 110, 0.43, 'SPINE B', '#334b60', 0.44);
  ink('network-label', 1300, 520, 450, 62, 'REDUNDANT FABRIC', 21, '#41617b');
  for (let index = 0; index < 3; index++) {
    equipment(`storage-${String(index + 1).padStart(2, '0')}`, 'storage',
      1280 + index * 163, 690, 115, 116, 1.75, `SAN 0${index + 1}`, '#637a8e');
  }
  ink('storage-label', 1290, 846, 450, 65, 'STORAGE / BACKUP', 23, '#41617b');

  // Physical data connections are shared editable edges, not decorative meshes.
  // Explicit heights route trunk cables above/behind the racks, clear of the aisle.
  for (const [row, y, source, cableColor] of [
    ['a', 266, 'spine-a', colors.teal], ['b', 608, 'spine-b', colors.blue],
  ] as const) {
    const sx = source === 'spine-a' ? 1390 : 1635;
    for (let index = 0; index < 5; index++) {
      const x = 277 + index * 174;
      link(`fabric-${row}-${index + 1}`, source, `rack-${row}-${String(index + 1).padStart(2, '0')}`,
        cableColor, [{ x: sx, y: y - 25, z: 2.48 }, { x, y: y - 25, z: 2.48 }, { x, y, z: 2.48 }]);
    }
  }
  for (let index = 0; index < 3; index++) {
    link(`storage-uplink-${index + 1}`, 'spine-b', `storage-${String(index + 1).padStart(2, '0')}`,
      colors.blue, [{ x: 1635, y: 620, z: 0.3 }, { x: 1337.5 + index * 163, y: 620, z: 0.3 }], 'bottom');
  }

  // NOC, access control and safety props; each can be moved or duplicated.
  equipment('access-door', 'door', 265, 1037, 138, 25, 2.3, 'ACCESS', '#557084');
  for (const [index, x] of [245, 650, 1055].entries()) {
    equipment(`console-${index + 1}`, 'workstation', x, 1180, 235, 125, 1.5,
      ['MONITORING', 'NETWORK', 'SECURITY'][index], '#c3cfd8');
  }
  equipment('plant-entrance', 'plant', 55, 1160, 90, 90, 1.5, '', '#94a790');
  equipment('plant-services', 'plant', 1630, 1150, 100, 100, 1.6, '', '#94a790');
  equipment('fire-main', 'extinguisher', 1100, 910, 34, 34, 0.85, '', '#bd4051');
  equipment('fire-services', 'extinguisher', 1740, 932, 34, 34, 0.85, '', '#bd4051');

  block('legend-teal', 228, 914, 36, 10, 0.025, colors.teal, 0.023);
  ink('legend-teal-text', 274, 890, 365, 60, 'FABRIC A  /  100 GbE', 20, '#41617b');
  block('legend-blue', 658, 914, 36, 10, 0.025, colors.blue, 0.023);
  ink('legend-blue-text', 704, 890, 365, 60, 'FABRIC B  /  STORAGE', 20, '#41617b');

  return {
    schemaVersion: 1, activePageId: 'data-centre', fileName: DATA_CENTRE_TITLE, status: 'draft',
    pages: [{ id: 'data-centre', name: 'Operations campus', nodes, edges,
      view3d: { version: 1, origin: [9, 0, 7.5],
        camera: { position: [20, 23, 28], target: [0, 0.65, 0] } } }],
  };
}
