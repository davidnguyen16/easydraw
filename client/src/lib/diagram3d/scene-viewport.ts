/** The active 3D viewport. Shared editor commands must never target the hidden
 * React Flow viewport while the user is editing a spatial view. */
export interface SceneViewport {
  zoomIn(): void;
  zoomOut(): void;
  setZoom(percent: number): void;
  fitView(): void;
  fitSelection(): void;
  exportImage(): Promise<string>;
}

let activeViewport: SceneViewport | undefined;

export function registerSceneViewport(viewport: SceneViewport): () => void {
  activeViewport = viewport;
  return () => {
    if (activeViewport === viewport) activeViewport = undefined;
  };
}

export function getSceneViewport(): SceneViewport | undefined {
  return activeViewport;
}
