import type { Viewport } from '@xyflow/svelte';

export interface CanvasNavigationController {
	constrainViewport: (viewport: Viewport) => Viewport;
	getViewportCenter: () => { x: number; y: number };
}
