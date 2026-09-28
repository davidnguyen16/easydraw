import { isVisual3DRecipe } from '@easydraw/diagram-schema';
import { createDataCentreDocument, DATA_CENTRE_TITLE } from '../../diagram3d/samples/data-centre';
import { buildDiagramScene, sceneNodeHalfExtents, type DiagramSceneNode, type Vec3 } from '../../diagram3d/scene-model';

/** The same public built-in factory as Dashboard, never a private saved copy.
 * No editor store, auth, external assets, or document writes belong here. */
const document = createDataCentreDocument();
const page = document.pages.find((candidate) => candidate.id === document.activePageId)!;
const scene = buildDiagramScene(page.nodes, page.edges, { origin: page.view3d?.origin });

function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

export const LANDING_TITLE = DATA_CENTRE_TITLE;
export const LANDING_PAGE = freezeTree(page);
export const LANDING_SCENE = freezeTree(scene);
export const LANDING_LINKS = LANDING_SCENE.edges;
export const LANDING_CAMERA = freezeTree({
  position: [...(page.view3d?.camera?.position ?? [20, 23, 28])] as Vec3,
  target: [...(page.view3d?.camera?.target ?? scene.center)] as Vec3,
});

export interface LandingEquipment extends DiagramSceneNode { zone: string }

// Inspection metadata does not replace labels or colours in the actual model.
const floors = [
  { id: 'floor-compute', name: 'Compute hall' },
  { id: 'floor-services', name: 'Infrastructure' },
  { id: 'floor-operations', name: 'Network operations' },
];
function zoneFor(node: DiagramSceneNode): string {
  const x = (node.position[0] + scene.origin[0]) * 100;
  const y = (node.position[2] + scene.origin[2]) * 100;
  for (const floor of floors) {
    const bounds = page.nodes.find((candidate) => candidate.id === floor.id);
    if (bounds && x >= bounds.position.x && x <= bounds.position.x + (bounds.width ?? 0)
      && y >= bounds.position.y && y <= bounds.position.y + (bounds.height ?? 0)) return floor.name;
  }
  return 'Operations campus';
}
export const LANDING_EQUIPMENT: readonly LandingEquipment[] = freezeTree(scene.nodes
  .filter((node) => isVisual3DRecipe(node.data.visual3d))
  .map((node) => ({ ...node,
    label: node.label || node.id.replace(/-/g, ' ').replace(/^./, (letter) => letter.toUpperCase()),
    zone: zoneFor(node),
  })));

// The campus is axis-aligned. Include every wall, label and connection in fit.
const minimum: Vec3 = [Infinity, Infinity, Infinity];
const maximum: Vec3 = [-Infinity, -Infinity, -Infinity];
function include(point: Vec3, half: Vec3 = [0, 0, 0]) {
  for (let axis = 0; axis < 3; axis++) {
    minimum[axis] = Math.min(minimum[axis], point[axis] - half[axis]);
    maximum[axis] = Math.max(maximum[axis], point[axis] + half[axis]);
  }
}
for (const node of scene.nodes) include(node.position, sceneNodeHalfExtents(node));
for (const edge of scene.edges) for (const point of edge.points) include(point);
export const LANDING_SCENE_BOUNDS = freezeTree({ minimum, maximum,
  width: maximum[0] - minimum[0], height: maximum[1] - minimum[1], depth: maximum[2] - minimum[2],
});
