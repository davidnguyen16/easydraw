import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { validateDiagramData, validateVisual3DRecipe, type Visual3DPart, type Visual3DRecipe } from '@easydraw/diagram-schema';
import { buildDiagramScene, type DiagramSceneNode } from '../scene-model';
import { buildRecipeGeometry } from '../recipe-geometry';
import { getFlatArtworkPlan } from '../flat-artwork';
import { createGeometryDocument } from './geometry';

const POINT_NAMES = ['A', 'B', 'C', "A'", "B'", "C'", 'M', 'N', 'K', 'H', 'F'] as const;
const PLANE_IDS = ['geometry-base-plane', 'geometry-angle-plane', 'geometry-target-plane'];

function expectPoint(actual: THREE.Vector3, expected: THREE.Vector3) {
  expect(actual.distanceTo(expected)).toBeCloseTo(0, 8);
}

/** Transform recipe coordinates exactly as the rendered construction does. */
function recipePoint(point: THREE.Vector3, node: DiagramSceneNode): THREE.Vector3 {
  return point.multiply(new THREE.Vector3(...node.size))
    .applyEuler(new THREE.Euler(...node.rotation)).add(new THREE.Vector3(...node.position));
}

function rodEnds(part: Visual3DPart, node: DiagramSceneNode): [THREE.Vector3, THREE.Vector3] {
  return [-1, 1].map((direction) => recipePoint(
    new THREE.Vector3(0, 0, part.size[2] * direction / 2)
      .applyEuler(new THREE.Euler(...part.rotation ?? [0, 0, 0]))
      .add(new THREE.Vector3(...part.position)), node,
  )) as [THREE.Vector3, THREE.Vector3];
}

/** Native vector vertices use the renderer's x/z drawing box, not recipe scale. */
function triangleVertices(node: DiagramSceneNode): [THREE.Vector3, THREE.Vector3, THREE.Vector3] {
  const plan = getFlatArtworkPlan(node);
  if (plan.kind !== 'vector') throw new Error('Expected an editable vector triangle');
  const vertices = plan.commands.filter(({ op }) => op === 'M' || op === 'L');
  expect(vertices).toHaveLength(3);
  return vertices.map(({ values: [x, z] }) =>
    new THREE.Vector3((x - plan.width / 2) / 100, 0, (z - plan.height / 2) / 100)
      .applyEuler(new THREE.Euler(...node.rotation)).add(new THREE.Vector3(...node.position)),
  ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
}

function construction() {
  const page = createGeometryDocument().pages[0];
  const scene = buildDiagramScene(page.nodes, page.edges);
  const node = scene.nodes.find(({ id }) => id === 'geometry-prism-construction')!;
  const recipe = node.data.visual3d as Visual3DRecipe;
  const spheres = recipe.parts.filter(({ shape }) => shape === 'sphere');
  expect(spheres).toHaveLength(POINT_NAMES.length);
  const points = Object.fromEntries(POINT_NAMES.map((name, index) =>
    [name, recipePoint(new THREE.Vector3(...spheres[index].position), node)],
  )) as Record<typeof POINT_NAMES[number], THREE.Vector3>;
  const planes = Object.fromEntries(PLANE_IDS.map((id) =>
    [id, triangleVertices(scene.nodes.find((item) => item.id === id)!)],
  )) as Record<string, [THREE.Vector3, THREE.Vector3, THREE.Vector3]>;
  return { page, scene, node, recipe, points, planes };
}

describe('triangular prism teaching sample', () => {
  it('creates valid editable vector planes and bounded renderable recipes', () => {
    const document = createGeometryDocument();
    expect(validateDiagramData(document).valid).toBe(true);
    const page = document.pages[0];
    const scene = buildDiagramScene(page.nodes, page.edges);
    expect(scene.warnings).toEqual([]);
    expect(page.view3d).toMatchObject({ orientation: 'floor', showGrid: false });
    const planes = page.nodes.filter(({ id }) => PLANE_IDS.includes(id));
    expect(planes).toHaveLength(3);
    for (const plane of planes) {
      expect(plane.type).toBe('VectorPathNode');
      expect(plane.draggable).not.toBe(false);
      expect(plane.data.locked).not.toBe(true);
      expect(getFlatArtworkPlan(scene.nodes.find(({ id }) => id === plane.id)!).kind).toBe('vector');
    }
    const constructionNodes = page.nodes.filter(({ type }) => type === 'CubeNode');
    expect(constructionNodes).toHaveLength(1);
    for (const node of constructionNodes) {
      const recipe = node.data.visual3d as Visual3DRecipe;
      expect(validateVisual3DRecipe(recipe).valid).toBe(true);
      for (const item of buildRecipeGeometry(recipe)) {
        item.geometry.computeBoundingBox();
        const bounds = item.geometry.boundingBox!;
        expect(bounds.min.toArray().every((value) => value >= -0.500001)).toBe(true);
        expect(bounds.max.toArray().every((value) => value <= 0.500001)).toBe(true);
        item.geometry.dispose();
      }
    }
  });

  it('renders a right equilateral prism with the given angle, height and volume', () => {
    const { points: p } = construction();
    const a = 4;
    for (const [from, to] of [['A', 'B'], ['B', 'C'], ['C', 'A'],
      ["A'", "B'"], ["B'", "C'"], ["C'", "A'"]] as const) {
      expect(p[from].distanceTo(p[to])).toBeCloseTo(a);
    }
    const ab = p.B.clone().sub(p.A), ac = p.C.clone().sub(p.A);
    const height = p["A'"].clone().sub(p.A);
    expect(height.length()).toBeCloseTo(3 * a / 2);
    expect(height.x).toBeCloseTo(0);
    expect(height.z).toBeCloseTo(0);
    expect(height.dot(ab)).toBeCloseTo(0);
    expect(height.dot(ac)).toBeCloseTo(0);
    expectPoint(p["B'"].clone().sub(p.B), height);
    expectPoint(p["C'"].clone().sub(p.C), height);
    expectPoint(p.N, p.B.clone().lerp(p.C, 0.5));
    expectPoint(p.K, p["B'"].clone().lerp(p["C'"], 0.5));
    expectPoint(p.M, p.A.clone().lerp(p["A'"], 0.5));
    expect(p.A.distanceTo(p.N)).toBeCloseTo(Math.sqrt(3) * a / 2);
    expect(p.A.clone().sub(p.N).angleTo(p["A'"].clone().sub(p.N))).toBeCloseTo(Math.PI / 3);
    // Scalar triple product measures the actual rendered prism's volume.
    expect(Math.abs(ab.cross(ac).dot(height)) / 2).toBeCloseTo(3 * Math.sqrt(3) * a ** 3 / 8);
  });

  it('aligns native triangles with named vertices and the 60-degree dihedral angle', () => {
    const { points: p, planes } = construction();
    const base = planes['geometry-base-plane'];
    const angle = planes['geometry-angle-plane'];
    const target = planes['geometry-target-plane'];
    for (const [vertices, names] of [[base, ['B', 'C', 'A']],
      [angle, ['B', 'C', "A'"]], [target, ["B'", "C'", 'A']]] as const) {
      vertices.forEach((point, index) => expectPoint(point, p[names[index]]));
    }
    const basePlane = new THREE.Plane().setFromCoplanarPoints(...base);
    const anglePlane = new THREE.Plane().setFromCoplanarPoints(...angle);
    const targetPlane = new THREE.Plane().setFromCoplanarPoints(...target);
    expect(Math.acos(Math.abs(basePlane.normal.dot(anglePlane.normal)))).toBeCloseTo(Math.PI / 3);
    expect(Math.abs(basePlane.normal.y)).toBeCloseTo(1);
    expect(Math.abs(targetPlane.distanceToPoint(p["A'"]))).toBeGreaterThan(0);
    expect(Math.abs(anglePlane.distanceToPoint(p.A))).toBeGreaterThan(0);
  });

  it('renders MF as the shortest distance to the whole target plane with correct projection feet', () => {
    const { points: p, planes, recipe, node } = construction();
    const a = 4;
    const target = new THREE.Plane().setFromCoplanarPoints(...planes['geometry-target-plane']);
    expectPoint(p.H, target.projectPoint(p["A'"], new THREE.Vector3()));
    expectPoint(p.F, target.projectPoint(p.M, new THREE.Vector3()));
    expectPoint(p.H, p.A.clone().lerp(p.K, 0.75));
    expectPoint(p.F, p.A.clone().lerp(p.H, 0.5));
    expect(target.distanceToPoint(p.H)).toBeCloseTo(0);
    expect(target.distanceToPoint(p.F)).toBeCloseTo(0);
    const mf = p.F.clone().sub(p.M);
    expect(mf.dot(p["B'"].clone().sub(p.A))).toBeCloseTo(0);
    expect(mf.dot(p["C'"].clone().sub(p.A))).toBeCloseTo(0);
    expect(mf.length()).toBeCloseTo(3 * a / 8);
    expect(Math.abs(target.distanceToPoint(p.M))).toBeCloseTo(3 * a / 8);
    expect(p["A'"].distanceTo(p.H)).toBeCloseTo(3 * a / 4);
    // Verify the solid red rod, not just its endpoints' point markers.
    const distanceRods = recipe.parts.filter(({ shape, color }) => shape === 'box' && color === '#b91c3b')
      .map((part) => rodEnds(part, node));
    const [from, to] = distanceRods.sort((left, right) =>
      right[0].distanceTo(right[1]) - left[0].distanceTo(left[1]),
    )[0];
    expectPoint(from, p.M);
    expectPoint(to, p.F);
  });

  it('provides upright English captions and correct final formulas', () => {
    const { page, scene } = construction();
    const labels = page.nodes.filter(({ id }) => id.startsWith('geometry-vertex-'));
    expect(labels.map(({ data }) => data.label)).toEqual(POINT_NAMES);
    for (const node of scene.nodes.filter(({ type }) => type === 'TextNode')) {
      expect(new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...node.rotation)).z).toBeCloseTo(1);
    }
    const notes = page.nodes.find(({ id }) => id === 'geometry-teaching-card')!.data.label;
    expect(notes).toContain('Right prism; equilateral bases.');
    expect(notes).toContain('V = 3√3 a³ / 8');
    expect(notes).toContain('MF = 3a / 8');
    expect(notes).toContain("MF ∥ A'H, so MF ⟂ (AB'C').");
  });

  it('allocates independent documents so editing one demo cannot change another run', () => {
    const first = createGeometryDocument(), second = createGeometryDocument();
    const recipe = first.pages[0].nodes.find(({ id }) => id === 'geometry-prism-construction')!
      .data.visual3d as Visual3DRecipe;
    recipe.parts[0].position[0] = 0.99;
    first.pages[0].nodes[0].data.opacity = 100;
    first.pages[0].nodes.find(({ id }) => id === 'geometry-teaching-card')!.data.label = 'changed';
    first.pages[0].view3d!.camera!.position[0] = 100;
    expect(second).toEqual(createGeometryDocument());
  });
});
