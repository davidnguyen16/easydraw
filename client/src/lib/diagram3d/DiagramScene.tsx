'use client';

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Box, Expand, Move, Rotate3D } from 'lucide-react';
import { dndState } from '@/lib/flow/dnd';
import type { DiagramSceneModel } from './scene-model';
import type { DiagramCamera, DiagramSceneEditing } from './types';
import { SceneNode3D, NodeTransformControl } from './SceneNode3D';
import { SceneConnection3D, EdgePointControl, EdgeEndpointControl, type SelectedBend, type SelectedEndpoint } from './SceneConnection3D';
import { SceneCameraRig, type CameraPreset, type DropProjector, type ViewRequest } from './SceneCameraRig';
import { SceneShadowLight } from './SceneLighting';
import { diagramToWorld, orientationRotation, type SceneOrientation } from './scene-orientation';

interface Props {
  model: DiagramSceneModel;
  camera?: DiagramCamera;
  onCameraChange: (camera: DiagramCamera) => void;
  onReturnTo2D: () => void;
  editing?: DiagramSceneEditing;
  rightInset?: number;
  /** Isolated, read-only embed: never register global editor controls/state. */
  standalone?: boolean;
  orientation?: SceneOrientation;
  onOrientationChange?: (orientation: SceneOrientation) => void;
  showGrid?: boolean;
  onShowGridChange?: (showGrid: boolean) => void;
}
type PendingConnection = (
  | { kind: 'new'; nodeId: string; handle?: string }
  | { kind: 'reconnect'; edgeId: string; end: 'source' | 'target' }
) & { tool: DiagramSceneEditing['tool'] };

const TOOL_BUTTON = 'rounded-lg border border-[#e7e0d6] bg-white px-3 py-2 text-xs font-medium text-[#423c35] shadow-sm transition hover:bg-[#f4efe6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a6192e]';

/** WebGL creation can fail before the Canvas error boundary is mounted. */
function hasWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const context = document.createElement('canvas').getContext('webgl2');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}
function SceneFallback({ onReturnTo2D, onRetry, compact = false }: { onReturnTo2D: () => void; onRetry?: () => void; compact?: boolean }) {
  return (
    <div role="alert" className={`flex h-full min-h-60 flex-col items-center justify-center bg-[#f8f5ee] text-center text-[#423c35] ${compact ? 'gap-2 p-4' : 'gap-3 p-8'}`}>
      <Box size={compact ? 22 : 30} className="text-[#a6192e]" />
      <p className={`font-semibold ${compact ? 'text-sm' : ''}`}>3D is unavailable in this browser session</p>
      <p className={`max-w-md text-[#756d62] ${compact ? 'text-xs' : 'text-sm'}`}>WebGL is unavailable or its graphics context was interrupted. Your diagram is unchanged. Enable browser hardware acceleration or return to the 2D view.</p>
      <div className="mt-2 flex gap-2">
        {onRetry && <button type="button" onClick={onRetry} className={TOOL_BUTTON}>Retry 3D</button>}
        <button type="button" onClick={onReturnTo2D} className={TOOL_BUTTON}>Return to 2D</button>
      </div>
    </div>
  );
}
class SceneErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function ContextGuard({ onLost }: { onLost: () => void }) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    const handleLost = (event: Event) => { event.preventDefault(); onLost(); };
    canvas.addEventListener('webglcontextlost', handleLost);
    return () => canvas.removeEventListener('webglcontextlost', handleLost);
  }, [canvas, onLost]);
  return null;
}

export default function DiagramScene({ model, camera, onCameraChange, onReturnTo2D, editing: editorControls, rightInset = 0, standalone = false,
  orientation: suppliedOrientation, onOrientationChange, showGrid: suppliedGrid, onShowGridChange }: Props) {
  const editing = standalone ? undefined : editorControls;
  const [localOrientation, setLocalOrientation] = useState<SceneOrientation>('floor');
  const [localGrid, setLocalGrid] = useState<boolean | undefined>();
  const orientation = suppliedOrientation ?? localOrientation;
  const showGrid = suppliedGrid ?? localGrid ?? editing?.showGrid ?? true;
  const [view, setView] = useState<ViewRequest>({ preset: 'isometric', nonce: 0 });
  const [viewerSelection, setViewerSelection] = useState<string | null>(null);
  const [selectedBend, setSelectedBend] = useState<SelectedBend | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<SelectedEndpoint | null>(null);
  const [connectionStart, setConnectionStart] = useState<PendingConnection | null>(null);
  const presenting = Boolean(editing?.disabled);
  const interactionMode = presenting ? 'disabled' : editing?.tool ?? 'viewer';
  const [previousMode, setPreviousMode] = useState(interactionMode);
  const [webglAvailable, setWebglAvailable] = useState(hasWebGL2);
  const [contextLost, setContextLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const projectDrop = useRef<DropProjector | null>(null);
  const loseContext = useCallback(() => setContextLost(true), []);
  const selectedIds = editing?.selectedNodeIds ?? (viewerSelection ? [viewerSelection] : []);
  const selected = model.nodes.find((node) => selectedIds.includes(node.id));
  const pending = !editing?.disabled && connectionStart?.tool === editing?.tool ? connectionStart : null;
  const canTransform = Boolean(editing && !editing.disabled && !['orbit', 'connect'].includes(editing.tool));
  const bendEdge = selectedBend && editing?.selectedEdgeIds.includes(selectedBend.edgeId)
    ? model.edges.find((edge) => edge.id === selectedBend.edgeId) : undefined;
  const endpointEdge = selectedEndpoint && editing?.selectedEdgeIds.includes(selectedEndpoint.edgeId)
    ? model.edges.find((edge) => edge.id === selectedEndpoint.edgeId) : undefined;

  // A partially chosen connection must not reappear after changing tools or
  // leaving presentation mode. This conditional reset derives only local UI.
  if (previousMode !== interactionMode) {
    setPreviousMode(interactionMode);
    setConnectionStart(null);
    setSelectedBend(null);
    setSelectedEndpoint(null);
  }

  useEffect(() => {
    function cancel(event: KeyboardEvent) {
      if (event.key === 'Escape') { setConnectionStart(null); setSelectedBend(null); setSelectedEndpoint(null); }
    }
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, []);

  function onSelectNode(id: string, additive: boolean, handle?: string) {
    if (!editing) { setViewerSelection(id); return; }
    if (editing.disabled || editing.tool === 'orbit') return;
    setSelectedBend(null);
    setSelectedEndpoint(null);
    if (pending?.kind === 'reconnect') {
      editing.onReconnect?.(pending.edgeId, pending.end, id, handle);
      setConnectionStart(null);
    } else if (editing.tool === 'connect') {
      if (pending?.kind === 'new') {
        editing.onConnect(pending.nodeId, id, pending.handle ?? 'right', handle ?? 'left');
        setConnectionStart(null);
      } else {
        setConnectionStart({ kind: 'new', nodeId: id, handle, tool: editing.tool });
        editing.onSelectNode(id, false);
      }
    } else editing.onSelectNode(id, additive);
  }
  function clearSelection() {
    setViewerSelection(null); setSelectedBend(null); setConnectionStart(null); setSelectedEndpoint(null);
    if (!editing?.disabled) editing?.onClearSelection();
  }
  const retry = () => { setWebglAvailable(hasWebGL2()); setContextLost(false); setAttempt((value) => value + 1); };
  const requestView = (preset: CameraPreset) => setView((previous) => ({ preset, nonce: previous.nonce + 1 }));
  const fallback = <SceneFallback onReturnTo2D={onReturnTo2D} onRetry={retry} compact={standalone} />;
  const gridSize = Math.max(model.radius * 3, 12);
  const shadows = model.nodes.some((node) => node.data.shadow === true);
  const cameraButton = standalone ? `${TOOL_BUTTON} !px-2 !py-1.5 !text-[11px]` : TOOL_BUTTON;
  return (
    <section className="relative h-full w-full overflow-hidden bg-[#f8f5ee]" aria-label="3D diagram"
      data-testid="diagram3d-scene" data-node-count={model.nodes.length} data-edge-count={model.edges.length}
      data-orientation={orientation} data-show-grid={showGrid}
      onDragOver={(event) => { if (editing && !editing.disabled) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
      onDrop={(event) => {
        event.preventDefault();
        if (standalone) return;
        const shape = dndState.current;
        dndState.current = null;
        if (!shape || !editing || editing.disabled || contextLost || !webglAvailable) return;
        const position = projectDrop.current?.(event.clientX, event.clientY);
        if (position) editing.onDropShape(shape, position);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {/* Read-only scene metadata for diagnostics; actual labels are rendered
          on meshes, never as floating DOM hit targets. */}
      <div hidden aria-hidden="true">
        {model.nodes.map((node) => <span key={node.id}
          data-scene-node={node.id}
          data-node-position={JSON.stringify(node.position)}
          data-node-world-position={JSON.stringify(diagramToWorld(node.position, orientation))}
          data-node-size={JSON.stringify(node.size)}
          data-node-rotation={JSON.stringify(node.rotation)}
          data-node-label={node.label}
          data-node-type={node.type}
          data-node-selected={selectedIds.includes(node.id)}
        />)}
      </div>
      {!webglAvailable || contextLost ? fallback : (
        <SceneErrorBoundary key={attempt} fallback={fallback}>
          <div ref={viewportRef} className={standalone ? 'absolute inset-x-0 bottom-9 top-[88px]' : 'absolute inset-0'} data-testid="diagram3d-viewport">
            <Canvas frameloop="demand" dpr={[1, 1.5]} shadows={shadows} camera={{ fov: 45, position: [10, 10, 10] }}
              gl={{ antialias: true, powerPreference: 'default', preserveDrawingBuffer: true }}
              fallback={fallback}
              onPointerMissed={(event) => {
                // Drei Html lives alongside the canvas. R3F's native event
                // listener can run before React stops a label/control click.
                if (event.target instanceof Element && event.target.closest('button, input, textarea, [data-scene-control]')) return;
                clearSelection();
              }}
              onCreated={({ gl }) => gl.setClearColor('#f8f5ee')}
            >
              <ambientLight intensity={1.35} />
              {!shadows && <directionalLight position={[12, 20, 8]} intensity={2.1} />}
              <directionalLight position={[-10, -8, -12]} intensity={0.65} />
              <group key={orientation} rotation={orientationRotation(orientation)}>
              {shadows && <SceneShadowLight model={model} />}
              {showGrid && <gridHelper args={[gridSize, 24, '#d8cabb', '#e9e1d5']} position={[model.center[0], -0.05, model.center[2]]} />}
              {model.nodes.map((node) => <SceneNode3D key={node.id} node={node} selected={selectedIds.includes(node.id)} editing={editing} connecting={Boolean(pending)} onSelect={onSelectNode} orientation={orientation} />)}
              {model.edges.map((edge) => (
                <SceneConnection3D key={edge.id} edge={edge} selected={editing?.selectedEdgeIds.includes(edge.id) ?? false}
                  editing={editing} bend={selectedBend} orientation={orientation}
                  onSelectBend={(bend) => { setSelectedBend(bend); setSelectedEndpoint(null); }}
                  onSelectEndpoint={(endpoint) => { setSelectedEndpoint(endpoint); setSelectedBend(null); }}
                  onReconnect={(edgeId, end) => { if (editing) setConnectionStart({ kind: 'reconnect', edgeId, end, tool: editing.tool }); }}
                />
              ))}
              </group>
              {/* Gizmos stay in world space. Their proxies convert back to the
                  untouched diagram coordinate system at the edit boundary. */}
              {canTransform && selected && !selected.locked && editing && <NodeTransformControl key={`node:${orientation}`} node={selected} editing={editing} orientation={orientation} />}
              {canTransform && !selected && bendEdge && selectedBend && editing && <EdgePointControl key={`bend:${orientation}`} edge={bendEdge} index={selectedBend.index} editing={editing} orientation={orientation} />}
              {canTransform && !selected && endpointEdge && selectedEndpoint && editing && <EdgeEndpointControl key={`endpoint:${orientation}`} edge={endpointEdge} end={selectedEndpoint.end} editing={editing} orientation={orientation} />}
              <SceneCameraRig model={model} camera={camera} onCameraChange={onCameraChange} view={view} editing={editing} viewportRef={viewportRef} projectDropRef={projectDrop} standalone={standalone} orientation={orientation} />
              <ContextGuard onLost={loseContext} />
            </Canvas>
          </div>
        </SceneErrorBoundary>
      )}
      {webglAvailable && !contextLost && (
        <>
          {/* Presenting: the top edge belongs to PresentBar and the bottom-right
              to its 2D/3D switch, so the badge goes and the camera views take
              the hint's bottom-left spot. */}
          {!presenting && !standalone && <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-xl border border-[#e7e0d6] bg-white/95 px-3 py-2 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-semibold text-[#423c35]"><Box size={14} className="text-[#a6192e]" />{editing ? '3D editor' : '3D view'}</p>
            <p className="mt-1 text-[11px] text-[#756d62]">{editing ? 'Shared objects, labels and connections' : 'Same diagram in space'}</p>
          </div>}
          <div className={`absolute z-20 flex max-w-[calc(100%-1rem)] flex-col gap-1.5 ${standalone ? 'left-2 right-2 top-2 items-center' : presenting ? 'bottom-4 left-4 items-start' : 'top-4 items-end'}`} style={presenting || standalone ? undefined : { right: rightInset + 16 }}>
            <div className="flex flex-wrap justify-end gap-1.5" role="group" aria-label="3D camera views">
              <button type="button" onClick={() => requestView('fit')} className={cameraButton} title="Fit entire diagram"><Expand size={14} className="mr-1.5 inline" />Fit</button>
              <button type="button" onClick={() => requestView('isometric')} className={cameraButton}>Isometric</button>
              <button type="button" onClick={() => requestView('top')} className={cameraButton}>Top</button>
              <button type="button" onClick={() => requestView('front')} className={cameraButton}>Front</button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5" role="group" aria-label="3D scene orientation">
              {(['floor', 'upright'] as const).map((value) => <button key={value} type="button" aria-pressed={orientation === value}
                onClick={() => { if (value !== orientation) { setLocalOrientation(value); onOrientationChange?.(value); } }}
                className={`${cameraButton} ${orientation === value ? '!border-[#a6192e] !text-[#a6192e]' : ''}`}
                title={value === 'floor' ? 'Lay the entire diagram on the floor' : 'Stand the entire diagram upright'}>{value === 'floor' ? 'Floor' : 'Upright'}</button>)}
              <button type="button" aria-pressed={showGrid} onClick={() => { setLocalGrid(!showGrid); onShowGridChange?.(!showGrid); }}
                className={`${cameraButton} ${showGrid ? '!border-[#a6192e] !text-[#a6192e]' : ''}`} title="Show or hide the scene grid">Grid</button>
            </div>
          </div>
          {pending && <div role="status" className="absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-lg border border-[#a6192e]/20 bg-white px-3 py-2 text-xs text-[#a6192e] shadow">
            {pending.kind === 'reconnect' ? 'Choose the new ' + pending.end + ' object or handle.' : 'Choose the target object or handle. Click the same object for a self-loop.'}
            <button type="button" className="ml-3 underline" onClick={() => setConnectionStart(null)}>Cancel</button>
          </div>}
          {!model.nodes.length && !model.edges.length && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
            <div className="max-w-sm rounded-xl bg-white/90 p-6 shadow-sm">
              <Box size={32} className="mx-auto mb-3 text-[#a6192e]" />
              <h2 className="font-semibold text-[#423c35]">Your 3D scene starts with a diagram</h2>
              <p className="mt-2 text-sm text-[#756d62]">{editing && !presenting ? 'Drag a shape from the library into this scene to start drawing in 3D.' : 'Add objects and connections to explore them in space.'}</p>
            </div>
          </div>}
          {standalone ? <p className="pointer-events-none absolute inset-x-2 bottom-3 text-center text-[10px] leading-4 text-[#756d62]">Drag to orbit · Right-drag to pan · Scroll to zoom</p> : !presenting && <div className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-[calc(100%-2rem)] rounded-lg border border-[#e7e0d6] bg-white/95 px-3 py-2 text-[11px] text-[#756d62] shadow-sm">
            <span className="mr-3 inline-flex items-center gap-1"><Rotate3D size={12} />Drag empty space to orbit</span>
            <span className="mr-3 inline-flex items-center gap-1"><Move size={12} />Right-drag to pan</span>
            <span>{editing ? 'Drag objects to move · Shift-click to multi-select · Double-click labels to edit' : 'Scroll to zoom'}</span>
          </div>}
          {model.warnings.length > 0 && (
            <details className="absolute bottom-16 left-4 z-20 max-h-44 max-w-md overflow-auto rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <summary className="cursor-pointer">{model.warnings.length} scene notice{model.warnings.length === 1 ? '' : 's'}</summary>
              <ul className="mt-2 space-y-1">{model.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
