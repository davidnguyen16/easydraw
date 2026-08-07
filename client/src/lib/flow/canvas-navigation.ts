import type { Viewport } from '@xyflow/react';

export interface CanvasNavigationController {
	constrainViewport: (viewport: Viewport) => Viewport;
	getViewportCenter: () => { x: number; y: number };
}
