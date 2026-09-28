import * as THREE from 'three';
import type { Visual3DRecipe } from '@easydraw/diagram-schema';
import { MATERIAL_COLORS, buildRecipeGeometry, safeColor } from './recipe-geometry';
import { recipeKey } from './visual3d';

/**
 * Small isometric pictures of 3D objects for the sidebar palette. One shared
 * offscreen WebGL renderer draws each recipe once; results are cached by
 * recipe content so a re-saved or re-listed object never renders twice.
 */
const SIZE = 128;
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null | undefined;

function getRenderer(): THREE.WebGLRenderer | null {
  if (renderer !== undefined) return renderer;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
  } catch {
    renderer = null;
  }
  return renderer;
}

export function renderObjectThumbnail(recipe: Visual3DRecipe): string | null {
  const key = recipeKey(recipe) + (recipe.fill ?? '');
  const cached = cache.get(key);
  if (cached) return cached;
  const gl = getRenderer();
  if (!gl) return null;

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 4, 3);
  scene.add(sun);

  // Present the object with the proportions it would have when dropped.
  const size = recipe.size ?? { width: 100, height: 100, depth: 1 };
  const scale = new THREE.Vector3(size.width / 100, size.depth, size.height / 100);
  const group = new THREE.Group();
  group.scale.copy(scale);
  const body = safeColor(recipe.fill, MATERIAL_COLORS.body);
  const built = buildRecipeGeometry(recipe);
  const materials: THREE.Material[] = [];
  for (const { material, color, geometry } of built) {
    const tint = material === 'body' ? body : material === 'custom' ? color ?? MATERIAL_COLORS.custom : MATERIAL_COLORS[material];
    const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: material === 'silver' ? 0.42 : 0.72, metalness: material === 'silver' ? 0.48 : 0.03 });
    materials.push(mat);
    group.add(new THREE.Mesh(geometry, mat));
  }
  scene.add(group);

  // Isometric camera framing the object's bounding sphere.
  const bounds = new THREE.Box3().setFromObject(group);
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.01) * 1.15;
  const camera = new THREE.OrthographicCamera(-radius, radius, radius, -radius, 0.01, radius * 10);
  camera.position.copy(sphere.center).add(new THREE.Vector3(1, 0.85, 1).normalize().multiplyScalar(radius * 4));
  camera.lookAt(sphere.center);

  gl.render(scene, camera);
  const url = gl.domElement.toDataURL('image/png');
  for (const { geometry } of built) geometry.dispose();
  for (const mat of materials) mat.dispose();
  cache.set(key, url);
  return url;
}
