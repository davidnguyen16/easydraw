import { describe, expect, it } from 'vitest';
import { SAMPLES } from '@/lib/dashboard/samples';
import { createDataCentreDocument, DATA_CENTRE_TITLE } from '@/lib/diagram3d/samples/data-centre';
import { buildDiagramScene } from '@/lib/diagram3d/scene-model';
import { buildRecipeGeometry } from '@/lib/diagram3d/recipe-geometry';
import { getVisual3DRecipe, recipeKey } from '@/lib/diagram3d/visual3d';
import { LANDING_CAMERA, LANDING_EQUIPMENT, LANDING_LINKS, LANDING_PAGE, LANDING_SCENE, LANDING_SCENE_BOUNDS, LANDING_TITLE } from './landing-data';

describe('Home reuses the Dashboard data-centre sample', () => {
  it('uses the exact Dashboard factory, including all original nodes, routing and camera', async () => {
    const dashboard = await SAMPLES.find((sample) => sample.id === 'data-centre')!.load();
    const document = dashboard.create();
    const page = document.pages.find((candidate) => candidate.id === document.activePageId)!;
    expect(LANDING_TITLE).toBe(dashboard.title);
    expect(LANDING_TITLE).toBe(DATA_CENTRE_TITLE);
    expect(LANDING_PAGE).toEqual(page);
    expect(LANDING_SCENE).toEqual(buildDiagramScene(page.nodes, page.edges, { origin: page.view3d?.origin }));
    expect(LANDING_CAMERA).toEqual(page.view3d!.camera);
  });

  it('retains the entire campus, original labels, colours and recipe content', () => {
    expect(LANDING_SCENE.nodes).toHaveLength(59);
    expect(LANDING_EQUIPMENT).toHaveLength(29);
    expect(LANDING_EQUIPMENT.filter((node) => node.id.startsWith('rack-'))).toHaveLength(10);
    expect(LANDING_LINKS).toHaveLength(13);
    const ids = new Set(LANDING_SCENE.nodes.map((node) => node.id));
    expect(ids.size).toBe(LANDING_PAGE.nodes.length);
    for (const id of ['foundation', 'wall-back', 'cold-aisle', 'hall-title', 'service-title', 'noc-title',
      'campus-title', 'console-1', 'access-door', 'plant-entrance', 'fire-services', 'storage-03']) expect(ids.has(id)).toBe(true);
    for (const source of LANDING_PAGE.nodes) {
      const derived = LANDING_SCENE.nodes.find((node) => node.id === source.id)!;
      expect(derived.data).toEqual(source.data);
      expect(derived.rotation.every((axis) => axis === 0)).toBe(true);
    }
    for (const source of LANDING_PAGE.edges) {
      expect(ids.has(source.source)).toBe(true);
      expect(ids.has(source.target)).toBe(true);
      const derived = LANDING_LINKS.find((edge) => edge.id === source.id)!;
      expect(derived.data).toEqual(source.data);
      expect(derived.color).toBe(source.data!.strokeColor);
      expect(derived.points.flat().every(Number.isFinite)).toBe(true);
    }
  });

  it('keeps dashboard documents and the Home view isolated and immutable', () => {
    const baseline = JSON.stringify(LANDING_PAGE);
    const copy = createDataCentreDocument();
    copy.pages[0].nodes[0].position.x = 12345;
    copy.pages[0].nodes[0].data.fillColor = '#000000';
    copy.pages[0].edges.pop();
    expect(JSON.stringify(LANDING_PAGE)).toBe(baseline);
    expect(Object.isFrozen(LANDING_PAGE.nodes[0].data)).toBe(true);
    expect(Object.isFrozen(LANDING_SCENE.nodes[0].position)).toBe(true);
    expect(Object.isFrozen(LANDING_LINKS[0].points[0])).toBe(true);
    expect(Object.isFrozen(LANDING_CAMERA.position)).toBe(true);
    expect(() => { LANDING_SCENE.nodes[0].position[0] = 100; }).toThrow();
    expect(createDataCentreDocument().pages[0]).toEqual(LANDING_PAGE);
  });

  it('preserves distinct elevations and fits all the structures, not only equipment', () => {
    const floor = LANDING_SCENE.nodes.find((node) => node.id === 'foundation')!;
    const switchNode = LANDING_SCENE.nodes.find((node) => node.id === 'spine-a')!;
    expect(floor.position[1] - floor.size[1] / 2).toBeCloseTo(-0.26);
    expect(switchNode.position[1] - switchNode.size[1] / 2).toBeCloseTo(0.44);
    expect(LANDING_SCENE_BOUNDS.width).toBeCloseTo(18.5);
    expect(LANDING_SCENE_BOUNDS.depth).toBeCloseTo(15.5);
    for (const node of LANDING_SCENE.nodes) {
      expect([...node.position, ...node.size].every(Number.isFinite)).toBe(true);
      node.position.forEach((value, axis) => {
        expect(value - node.size[axis] / 2).toBeGreaterThanOrEqual(LANDING_SCENE_BOUNDS.minimum[axis] - 1e-8);
        expect(value + node.size[axis] / 2).toBeLessThanOrEqual(LANDING_SCENE_BOUNDS.maximum[axis] + 1e-8);
      });
    }
  });

  it('shares repeated recipes within a bounded full-campus geometry budget', () => {
    const recipes = new Map<string, { recipe: NonNullable<ReturnType<typeof getVisual3DRecipe>>; count: number }>();
    for (const node of LANDING_EQUIPMENT) {
      const recipe = getVisual3DRecipe(node.type, node.data)!;
      expect(recipe).toBeTruthy();
      const key = recipeKey(recipe), existing = recipes.get(key);
      recipes.set(key, { recipe, count: (existing?.count ?? 0) + 1 });
    }
    expect(recipes.size).toBeLessThan(LANDING_EQUIPMENT.length);
    let calls = 0, vertices = 0;
    for (const { recipe, count } of recipes.values()) {
      const before = JSON.stringify(recipe);
      const parts = buildRecipeGeometry(recipe);
      calls += parts.length * count;
      for (const { geometry } of parts) { vertices += geometry.getAttribute('position').count; geometry.dispose(); }
      expect(JSON.stringify(recipe)).toBe(before);
    }
    expect(calls).toBeLessThan(250);
    expect(vertices).toBeLessThan(200_000);
  });
});
