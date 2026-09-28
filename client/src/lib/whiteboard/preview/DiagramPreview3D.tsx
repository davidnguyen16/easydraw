'use client';

import { useMemo } from 'react';
import type { DiagramCamera3D, PagedDiagramData } from '@easydraw/diagram-schema';
import DiagramScene from '@/lib/diagram3d/DiagramScene';
import { createPreviewScene } from './preview-scene';

interface Props {
  document: PagedDiagramData;
  camera?: DiagramCamera3D;
  onCameraChange: (camera: DiagramCamera3D) => void;
  onReturnTo2D: () => void;
  orientation: 'floor' | 'upright';
  onOrientationChange: (orientation: 'floor' | 'upright') => void;
  showGrid: boolean;
  onShowGridChange: (visible: boolean) => void;
}

/** Loaded only for a visible 3D preview. No editor wrapper, global viewport
 * registration, editing callbacks, storage or request lifecycle lives here. */
export default function DiagramPreview3D({ document, camera, onCameraChange, onReturnTo2D, ...presentation }: Props) {
  const model = useMemo(() => createPreviewScene(document), [document]);
  return <div data-testid="diagram-preview-3d" className="absolute inset-0">
    <DiagramScene standalone model={model} camera={camera} onCameraChange={onCameraChange} onReturnTo2D={onReturnTo2D} {...presentation} />
  </div>;
}
