export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;
export const MIN_ZOOM_PERCENT = MIN_ZOOM * 100;
export const MAX_ZOOM_PERCENT = MAX_ZOOM * 100;

export const ZOOM_STEP = 1.15;
export const ZOOM_TRANSITION_MS = 140;
export const ZOOM_PRESETS = [20, 25, 50, 75, 100, 125, 150, 200] as const;

export function clampZoom(zoom: number) {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

// A short ease-out responds immediately but still settles without a hard stop.
export function zoomEaseOut(progress: number) {
	return 1 - Math.pow(1 - progress, 3);
}
