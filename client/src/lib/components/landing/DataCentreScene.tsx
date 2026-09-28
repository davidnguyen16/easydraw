'use client';

import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Line, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { Visual3DRecipe } from '@easydraw/diagram-schema';
import { buildRecipeGeometry, MATERIAL_COLORS, safeColor, type RecipeGeometry } from '@/lib/diagram3d/recipe-geometry';
import { getVisual3DRecipe, recipeKey } from '@/lib/diagram3d/visual3d';
import type { DiagramSceneNode } from '@/lib/diagram3d/scene-model';
import NodeSurfaceLabel from '@/lib/diagram3d/NodeSurfaceLabel';
import { LANDING_CAMERA, LANDING_EQUIPMENT, LANDING_SCENE, LANDING_SCENE_BOUNDS } from './landing-data';

export interface DataCentreSceneProps {
  autoRotate: boolean;
  motionAllowed: boolean;
  resetKey: number;
  onReady?: () => void;
  onUnavailable: () => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

const INITIAL_CAMERA = LANDING_CAMERA.position;
const CAMERA_TARGET = LANDING_CAMERA.target;
const EQUIPMENT_IDS = new Set(LANDING_EQUIPMENT.map((node) => node.id));
const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const HORIZONTAL_RADIUS = Math.hypot(
  Math.max(...[LANDING_SCENE_BOUNDS.minimum[0], LANDING_SCENE_BOUNDS.maximum[0]].map((value) => Math.abs(value - CAMERA_TARGET[0]))),
  Math.max(...[LANDING_SCENE_BOUNDS.minimum[2], LANDING_SCENE_BOUNDS.maximum[2]].map((value) => Math.abs(value - CAMERA_TARGET[2]))),
);
const VERTICAL_RADIUS = Math.max(...[LANDING_SCENE_BOUNDS.minimum[1], LANDING_SCENE_BOUNDS.maximum[1]].map((value) => Math.abs(value - CAMERA_TARGET[1])));

function hasWebGL2() {
  try {
    const context = document.createElement('canvas').getContext('webgl2');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

function Unavailable({ onUnavailable }: { onUnavailable: () => void }) {
  useEffect(() => onUnavailable(), [onUnavailable]);
  return null;
}

class SceneBoundary extends Component<{ children: ReactNode; onUnavailable: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** The complete Dashboard sample rendered without the editor's stores, tools,
 * user assets or document lifecycle. Only camera/selection state is local. */
export default function DataCentreScene(props: DataCentreSceneProps) {
  const [available] = useState(hasWebGL2);
  const rotating = props.autoRotate && props.motionAllowed;
  if (!available) return <Unavailable onUnavailable={props.onUnavailable} />;
  return <div data-testid="landing-data-centre-scene" data-autorotate={rotating} data-equipment-count={LANDING_EQUIPMENT.length}
    data-node-count={LANDING_SCENE.nodes.length} data-edge-count={LANDING_SCENE.edges.length}
    className="absolute inset-0" style={{ touchAction: 'pan-y' }}>
    <SceneBoundary onUnavailable={props.onUnavailable}>
      <Canvas orthographic camera={{ position: INITIAL_CAMERA, zoom: 20, near: 0.1, far: 200 }}
        dpr={[1, 1.5]} frameloop={rotating ? 'always' : 'demand'} shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        onCreated={({ gl }) => { gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = true; }}
        // Fiber mounts this as the canvas's HTML fallback even with working
        // WebGL. Only the capability guard/boundary may report unavailability.
        fallback={<span>Explore this data centre in the 2D view.</span>}
        onPointerMissed={() => props.onSelect?.(null)}
        style={{ touchAction: 'pan-y' }}>
        <ambientLight intensity={1.35} />
        <directionalLight position={[12, 20, 8]} intensity={2.1} castShadow
          shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0005} shadow-normalBias={0.025}
          shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18}
          shadow-camera-near={0.1} shadow-camera-far={80} />
        <directionalLight position={[-10, -8, -12]} intensity={0.65} />
        <ShowcaseObjects selectedId={props.selectedId} onSelect={props.onSelect} />
        <CameraRig {...props} rotating={rotating} />
      </Canvas>
    </SceneBoundary>
  </div>;
}

function ShowcaseObjects({ selectedId, onSelect }: Pick<DataCentreSceneProps, 'selectedId' | 'onSelect'>) {
  const recipes = useMemo(() => {
    const cache = new Map<string, RecipeGeometry[]>();
    const nodes = new Map<string, { recipe: Visual3DRecipe; parts: RecipeGeometry[] }>();
    for (const node of LANDING_SCENE.nodes) {
      const recipe = getVisual3DRecipe(node.type, node.data);
      if (!recipe) continue;
      const key = recipeKey(recipe);
      let parts = cache.get(key);
      if (!parts) { parts = buildRecipeGeometry(recipe); cache.set(key, parts); }
      nodes.set(node.id, { recipe, parts });
    }
    return { cache, nodes };
  }, []);
  useEffect(() => () => {
    for (const parts of recipes.cache.values()) for (const part of parts) part.geometry.dispose();
  }, [recipes]);
  return <group name="dashboard-data-centre">
    {LANDING_SCENE.nodes.map((node) => {
      const recipe = recipes.nodes.get(node.id);
      const interactive = EQUIPMENT_IDS.has(node.id);
      return <group key={node.id} name={`node:${node.id}`} position={node.position} rotation={node.rotation}
        onClick={interactive ? (event) => {
          event.stopPropagation();
          if (event.delta < 4) onSelect?.(selectedId === node.id ? null : node.id);
        } : undefined}>
        {recipe ? <RecipeObject node={node} {...recipe} selected={selectedId === node.id} />
          : node.type === 'CubeNode' ? <mesh scale={node.size} castShadow={node.data.shadow === true} receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={node.color} roughness={0.68} metalness={0.04} side={THREE.DoubleSide} />
          </mesh> : null}
        <NodeSurfaceLabel node={node} />
      </group>;
    })}
    {/* These are the Dashboard routes, including the elevated redundant fabric,
        not a second set of marketing cables laid across a different floor. */}
    {LANDING_SCENE.edges.map((edge) => <Line key={edge.id} name={`edge:${edge.id}`}
      points={edge.points} color={edge.color} lineWidth={edge.width} />)}
  </group>;
}

/** Match RecipeVisual3D's materials exactly, but share repeated recipe geometry
 * across all racks in this immutable sample instead of rebuilding per object. */
function RecipeObject({ node, recipe, parts, selected }: {
  node: DiagramSceneNode; recipe: Visual3DRecipe; parts: RecipeGeometry[]; selected: boolean;
}) {
  const opacity = Math.max(0, Math.min(1, finite(node.data.opacity, 100) / 100));
  const body = safeColor(node.data.fillColor, safeColor(recipe.fill, MATERIAL_COLORS.body));
  const fillVisible = node.data.fillColor !== 'transparent' && node.data.fillColor !== 'none';
  return <group scale={node.size}>
    {parts.map(({ material, color, geometry }, index) => {
      const tint = material === 'body' ? body : material === 'custom' ? color ?? MATERIAL_COLORS.custom : MATERIAL_COLORS[material];
      const glow = material === 'teal' || material === 'blue' || material === 'screen';
      const alpha = opacity * (material === 'body' && !fillVisible ? 0.04 : 1);
      return <mesh key={`${material}:${color ?? ''}:${index}`} castShadow={node.data.shadow === true && !glow} receiveShadow>
        {/* Primitives do not take ownership of shared geometry; the parent
            cache disposes it once. JSX materials retain normal R3F cleanup. */}
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial color={tint} roughness={material === 'silver' ? 0.42 : 0.72}
          metalness={material === 'silver' ? 0.48 : material === 'frame' ? 0.22 : 0.03}
          transparent={alpha < 1} opacity={alpha} depthWrite={alpha >= 0.5}
          emissive={selected ? '#a6192e' : glow ? tint : '#000000'} emissiveIntensity={selected ? 0.08 : glow ? 0.25 : 0} />
      </mesh>;
    })}
    {selected && <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      <Edges color="#a6192e" lineWidth={Math.max(1.5, Math.min(4, finite(node.data.borderWidth, 1.5)))} transparent opacity={opacity} />
    </mesh>}
  </group>;
}

function CameraRig({ rotating, resetKey, onReady, onUnavailable }: DataCentreSceneProps & { rotating: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const get = useThree((state) => state.get);
  const canvas = useThree((state) => state.gl.domElement);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const ready = useRef(false);
  const callbacks = useRef({ onReady, onUnavailable });
  useLayoutEffect(() => { callbacks.current = { onReady, onUnavailable }; }, [onReady, onUnavailable]);
  // Bound every azimuth, so automatic rotation cannot crop the full campus or
  // visibly pump the zoom. Manual elevation changes refit the projected height.
  const fit = useCallback(() => {
    const { camera, size } = get();
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const dx = camera.position.x - CAMERA_TARGET[0], dy = camera.position.y - CAMERA_TARGET[1], dz = camera.position.z - CAMERA_TARGET[2];
    const length = Math.max(0.001, Math.hypot(dx, dy, dz));
    const halfHeight = HORIZONTAL_RADIUS * Math.abs(dy) / length + VERTICAL_RADIUS * Math.hypot(dx, dz) / length;
    const zoom = Math.min(size.width / Math.max(1, HORIZONTAL_RADIUS * 2.16), size.height / Math.max(1, halfHeight * 2.16));
    if (Math.abs(camera.zoom - zoom) < 0.000001) return;
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }, [get]);
  const report = () => {
    const { gl, camera } = get();
    gl.domElement.dataset.cameraPosition = JSON.stringify(camera.position.toArray());
    gl.domElement.dataset.cameraTarget = JSON.stringify(controls.current?.target.toArray() ?? CAMERA_TARGET);
    if (camera instanceof THREE.OrthographicCamera) gl.domElement.dataset.cameraZoom = String(camera.zoom);
  };
  useEffect(() => {
    fit();
    invalidate();
  }, [fit, invalidate, size.width, size.height]);
  useEffect(() => {
    const { camera } = get();
    camera.position.fromArray(INITIAL_CAMERA);
    controls.current?.target.fromArray(CAMERA_TARGET);
    camera.lookAt(new THREE.Vector3(...CAMERA_TARGET));
    controls.current?.update();
    fit();
    invalidate();
  }, [get, fit, invalidate, resetKey]);
  useEffect(() => {
    const element = get().gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); callbacks.current.onUnavailable(); };
    element.addEventListener('webglcontextlost', lost);
    // The child controls.connect() runs first and sets touch-action:none on its
    // DOM element. We explicitly bind that element to this canvas below, then
    // allow one-finger page scrolling here. Never leave none on a R3F ancestor:
    // browsers intersect touch-action across the entire ancestor chain.
    const previousTouchAction = element.style.touchAction === 'none' ? 'auto' : element.style.touchAction;
    element.style.touchAction = 'pan-y';
    return () => {
      element.removeEventListener('webglcontextlost', lost);
      if (element.style.touchAction === 'pan-y') element.style.touchAction = previousTouchAction;
    };
  }, [canvas, get]);
  useFrame(() => {
    fit();
    report();
    if (ready.current) return;
    ready.current = true;
    const { gl } = get();
    gl.shadowMap.needsUpdate = true;
    // R3F renders immediately after its subscribers; this callback runs after
    // that render without a second animation loop or a global event handler.
    queueMicrotask(() => { gl.domElement.dataset.renderReady = 'true'; callbacks.current.onReady?.(); });
  });
  return <OrbitControls ref={controls} domElement={canvas} makeDefault target={CAMERA_TARGET} autoRotate={rotating} autoRotateSpeed={0.45}
    enableDamping={false} enableZoom={false} enablePan={false} minPolarAngle={0.45} maxPolarAngle={1.25}
    rotateSpeed={0.55} touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }} onEnd={report} />;
}
