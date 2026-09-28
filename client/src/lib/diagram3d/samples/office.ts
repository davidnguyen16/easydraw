import type { Node } from '@xyflow/react';
import { cloneVisual3DRecipe } from '@easydraw/diagram-schema';
import { getObject3D } from '@easydraw/objects-3d';
import type { EditorState } from '../../stores/editor-doc.store';

export const OFFICE_TITLE = 'Office — HQ Level 4';

/** Original, asset-free cutaway of one office floor: reception, meeting room,
 * phone booths, open-plan desks, a manager's office and the lounge kitchen.
 * Every piece of furniture is an ordinary editable CubeNode carrying a 3D
 * recipe copied from the @easydraw/objects-3d starter set — the same objects
 * a user drops from the "Office" and "Data centre" libraries, so nothing in
 * the sample is special. Every call allocates an independent JSON document.
 */
export function createOfficeDocument(): EditorState {
  const nodes: Node[] = [];
  const colors = { ink: '#22334a', wall: '#e3e6e3', glass: '#bfe3ef', muted: '#5d6f80' };

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

  /** A starter object at its own footprint; height, colour and label default to the recipe. */
  function furniture(id: string, kind: string, x: number, y: number, options: {
    width?: number; depth?: number; height?: number; label?: string; fill?: string; elevation?: number;
  } = {}) {
    const object = getObject3D(kind);
    if (!object) throw new Error(`The office sample needs the "${kind}" starter object.`);
    const recipe = { version: 2 as const, parts: cloneVisual3DRecipe(object.recipe).parts };
    const size = object.recipe.size ?? { width: 60, height: 60, depth: 1 };
    return block(id, x, y, options.width ?? size.width, options.depth ?? size.height,
      options.height ?? size.depth, options.fill ?? object.recipe.fill ?? '#8a8b83', options.elevation ?? 0.02, {
        visual3d: recipe, label: options.label ?? '', textColor: '#f0f7fb', fontSize: 13, shadow: true,
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

  // Plinth and floor zones stay editable; negative zIndex only orders the 2D canvas.
  const foundation = block('foundation', -25, -25, 1850, 1350, 0.24, '#c9c4b8', -0.26);
  foundation.zIndex = -10;
  foundation.data.locked = true;
  const zones = [
    ['floor-reception', 0, 0, 520, 420, '#f3efe8'],
    ['floor-meeting', 540, 0, 640, 420, '#eef2f5'],
    ['floor-focus', 1200, 0, 600, 420, '#f0f0ee'],
    ['floor-work', 0, 440, 1200, 520, '#f6f6f3'],
    ['floor-manager', 1220, 440, 580, 520, '#eef2f5'],
    ['floor-lounge', 0, 980, 1800, 260, '#f4efe6'],
    ['floor-title', 0, 1250, 1800, 75, '#e6e1d6'],
  ] as const;
  for (const [id, x, y, w, d, fill] of zones) {
    const floor = block(id, x, y, w, d, 0.035, fill, -0.02);
    floor.zIndex = -9;
    floor.data.locked = true;
  }

  // Back and left walls only, so the cutaway stays open; glass keeps rooms legible.
  block('wall-back', 0, -8, 1800, 18, 2.65, colors.wall);
  block('wall-left', -8, 10, 18, 1230, 2.65, colors.wall);
  block('wall-back-cap', 0, -8, 1800, 18, 0.035, '#9aa39c', 2.65);
  block('wall-left-cap', -8, 10, 18, 1230, 0.035, '#9aa39c', 2.65);
  block('glass-meeting-left', 530, 10, 10, 410, 2.6, colors.glass);
  block('glass-focus-left', 1190, 10, 10, 410, 2.6, colors.glass);
  block('glass-manager-left', 1210, 450, 10, 510, 2.6, colors.glass);
  furniture('glass-meeting-front-a', 'glass-partition', 550, 418, { width: 250, depth: 8, height: 2.6 });
  furniture('door-meeting', 'door', 800, 410, { label: 'MEETING' });
  furniture('glass-meeting-front-b', 'glass-partition', 938, 418, { width: 242, depth: 8, height: 2.6 });
  furniture('glass-manager-top', 'glass-partition', 1220, 436, { width: 380, depth: 8, height: 2.6 });
  furniture('door-manager', 'door', 1600, 428);
  furniture('glass-manager-top-b', 'glass-partition', 1738, 436, { width: 62, depth: 8, height: 2.6 });
  block('room-edge-right', 1790, 10, 10, 1230, 0.14, '#b3ada0');

  // Reception.
  furniture('reception-desk', 'reception-desk', 40, 60, { label: 'RECEPTION' });
  furniture('reception-sign', 'sign-stand', 300, 70);
  furniture('reception-clock', 'wall-clock', 380, -4, { elevation: 1.9 });
  furniture('reception-chair-a', 'armchair', 60, 250);
  furniture('reception-chair-b', 'armchair', 250, 250);
  furniture('reception-table', 'coffee-table', 158, 262);
  furniture('reception-plant', 'plant', 410, 290);
  furniture('reception-visitor', 'person', 150, 195, { fill: '#c46a5a' });
  ink('reception-title', 40, 372, 400, 40, 'RECEPTION', 22, colors.muted);

  // Meeting room: table for six, display, whiteboard.
  furniture('meeting-table', 'meeting-table', 700, 140, { label: 'HUDDLE 1' });
  for (const [index, x] of [715, 800, 885].entries()) {
    furniture(`meeting-chair-top-${index + 1}`, 'conference-chair', x, 82);
    furniture(`meeting-chair-bottom-${index + 1}`, 'conference-chair', x, 262);
  }
  furniture('meeting-laptop', 'laptop', 805, 178, { elevation: 0.77 });
  furniture('meeting-display', 'tv-screen', 760, 14);
  furniture('meeting-whiteboard', 'whiteboard', 1040, 180);
  furniture('meeting-plant', 'plant', 570, 315);
  furniture('meeting-person', 'person', 1010, 300, { fill: '#3f91be' });
  ink('meeting-title', 560, 372, 400, 40, 'MEETING ROOM', 22, colors.muted);

  // Focus zone: phone booths, lockers, printing.
  for (const [index, x] of [1260, 1400, 1540].entries()) {
    furniture(`booth-${index + 1}`, 'phone-booth', x, 40, { label: `BOOTH ${index + 1}` });
  }
  furniture('focus-lockers', 'lockers', 1300, 300);
  furniture('focus-printer', 'printer', 1650, 300, { label: 'PRINT' });
  furniture('focus-wifi', 'wifi-controller', 1700, 20, { elevation: 2.1, label: 'WLAN' });
  ink('focus-title', 1220, 372, 500, 40, 'FOCUS & PHONE BOOTHS', 22, colors.muted);

  // Open-plan workspace: two rows of desks, two standing desks.
  for (const [row, y] of [['a', 520], ['b', 760]] as const) {
    for (let index = 0; index < 4; index++) {
      const seat = `${row.toUpperCase()}-${String(index + 1).padStart(2, '0')}`;
      furniture(`desk-${row}-${index + 1}`, 'desk', 80 + index * 240, y, { label: seat });
      furniture(`chair-${row}-${index + 1}`, 'office-chair', 135 + index * 240, y + 90);
    }
    furniture(`standing-desk-${row}`, 'standing-desk', 1020, y, { label: `${row.toUpperCase()}-05` });
  }
  furniture('work-cabinet-a', 'filing-cabinet', 12, 470);
  furniture('work-cabinet-b', 'filing-cabinet', 12, 540);
  furniture('work-bookshelf', 'bookshelf', 300, 445);
  furniture('work-person-a', 'person', 270, 640, { fill: '#2e7153' });
  furniture('work-person-b', 'person', 760, 905, { fill: '#8c6f5a' });
  furniture('work-plant', 'plant', 1100, 880);
  ink('work-title', 40, 912, 500, 40, 'OPEN-PLAN WORKSPACE', 22, colors.muted);

  // Manager's office.
  furniture('manager-desk', 'desk', 1400, 600, { label: 'MGR' });
  furniture('manager-chair', 'office-chair', 1455, 690);
  furniture('manager-bookshelf', 'bookshelf', 1560, 452);
  furniture('manager-cabinet', 'filing-cabinet', 1730, 460);
  furniture('manager-armchair-a', 'armchair', 1260, 800);
  furniture('manager-armchair-b', 'armchair', 1400, 800);
  furniture('manager-plant', 'plant', 1700, 840);
  ink('manager-title', 1240, 912, 400, 40, 'MANAGER OFFICE', 22, colors.muted);

  // Lounge and kitchen.
  furniture('kitchen-counter', 'kitchen-counter', 40, 1010, { label: 'KITCHEN' });
  furniture('kitchen-cooler', 'water-cooler', 270, 1015);
  furniture('lounge-sofa-a', 'sofa', 480, 1020);
  furniture('lounge-sofa-b', 'sofa', 720, 1020);
  furniture('lounge-table', 'coffee-table', 625, 1120);
  furniture('lounge-bookshelf', 'bookshelf', 1000, 1000);
  furniture('lounge-plant-a', 'plant', 1200, 1100);
  furniture('lounge-plant-b', 'plant', 1740, 1100);
  furniture('lounge-person-a', 'person', 320, 1130, { fill: '#c46a5a' });
  furniture('lounge-person-b', 'person', 1120, 1160, { fill: '#3f91be' });
  ink('lounge-title', 40, 1195, 500, 40, 'LOUNGE & KITCHEN', 22, colors.muted);

  ink('office-title', 160, 1248, 1100, 82, 'NORTHSTAR  /  HQ LEVEL 4', 44);
  ink('office-subtitle', 1280, 1259, 450, 55, '10 SEATS · OPEN PLAN', 20, '#52697f');

  return {
    schemaVersion: 1, activePageId: 'office', fileName: OFFICE_TITLE, status: 'draft',
    pages: [{ id: 'office', name: 'HQ level 4', nodes, edges: [],
      view3d: { version: 1, origin: [9, 0, 6.5],
        camera: { position: [20, 22, 27], target: [0, 0.65, 0] } } }],
  };
}
