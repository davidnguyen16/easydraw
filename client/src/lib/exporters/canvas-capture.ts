/**
 * Capture the complete diagram rather than the user's current screen viewport.
 *
 * SvelteFlow renders nodes and edges inside one transformed viewport. During
 * capture we override that transform on html-to-image's clone so the diagram's
 * flow-coordinate bounds land at the top-left of the exported image. The live
 * canvas is never panned or zoomed and surrounding editor chrome is excluded.
 */
import { toJpeg, toPng } from 'html-to-image';
import type { ExportBounds } from './types';

export interface CaptureOptions {
	backgroundColor?: string;
	pixelRatio?: number;
	quality?: number;
	padding?: number;
}

const DEFAULTS: Required<Pick<CaptureOptions, 'backgroundColor' | 'pixelRatio'>> = {
	backgroundColor: '#ffffff',
	pixelRatio: 2
};

const DEFAULT_PADDING = 40;
const MAX_RASTER_SIDE = 16_384;
const MAX_RASTER_AREA = 64_000_000;

function pickViewport(root: HTMLElement | null): HTMLElement {
	if (!root) throw new Error('Canvas element is not mounted');
	const viewport = root.querySelector<HTMLElement>('.svelte-flow__viewport');
	if (!viewport) throw new Error('Could not find SvelteFlow viewport to capture');
	return viewport;
}

function isUsableBounds(bounds: ExportBounds | null): bounds is ExportBounds {
	return (
		!!bounds &&
		Number.isFinite(bounds.x) &&
		Number.isFinite(bounds.y) &&
		Number.isFinite(bounds.width) &&
		Number.isFinite(bounds.height) &&
		bounds.width >= 0 &&
		bounds.height >= 0
	);
}

function getCaptureGeometry(
	root: HTMLElement | null,
	bounds: ExportBounds | null,
	padding = DEFAULT_PADDING
) {
	const viewport = pickViewport(root);

	if (!isUsableBounds(bounds)) {
		const rect = viewport.getBoundingClientRect();
		return {
			viewport,
			width: Math.max(1, Math.ceil(rect.width)),
			height: Math.max(1, Math.ceil(rect.height)),
			transform: getComputedStyle(viewport).transform
		};
	}

	const safePadding = Math.max(0, padding);
	return {
		viewport,
		width: Math.max(1, Math.ceil(bounds.width + safePadding * 2)),
		height: Math.max(1, Math.ceil(bounds.height + safePadding * 2)),
		transform: `translate(${safePadding - bounds.x}px, ${safePadding - bounds.y}px) scale(1)`
	};
}

/**
 * Browsers impose canvas dimension and area limits. Keep the requested 2x
 * output where possible, but reduce only raster density for unusually large
 * diagrams so export completes instead of producing a blank image.
 */
function getSafePixelRatio(width: number, height: number, requested: number): number {
	const positiveRequested = Math.max(0.1, requested);
	const bySide = MAX_RASTER_SIDE / Math.max(width, height);
	const byArea = Math.sqrt(MAX_RASTER_AREA / Math.max(1, width * height));
	return Math.max(0.1, Math.min(positiveRequested, bySide, byArea));
}

function getImageOptions(
	root: HTMLElement | null,
	bounds: ExportBounds | null,
	options: CaptureOptions
) {
	const geometry = getCaptureGeometry(root, bounds, options.padding);
	return {
		geometry,
		imageOptions: {
			width: geometry.width,
			height: geometry.height,
			backgroundColor: options.backgroundColor ?? DEFAULTS.backgroundColor,
			pixelRatio: getSafePixelRatio(
				geometry.width,
				geometry.height,
				options.pixelRatio ?? DEFAULTS.pixelRatio
			),
			cacheBust: true,
			style: {
				width: `${geometry.width}px`,
				height: `${geometry.height}px`,
				transform: geometry.transform,
				transformOrigin: '0 0'
			}
		}
	};
}

export async function captureAsPng(
	root: HTMLElement | null,
	bounds: ExportBounds | null,
	options: CaptureOptions = {}
): Promise<string> {
	const { geometry, imageOptions } = getImageOptions(root, bounds, options);
	return toPng(geometry.viewport, imageOptions);
}

export async function captureAsJpeg(
	root: HTMLElement | null,
	bounds: ExportBounds | null,
	options: CaptureOptions = {}
): Promise<string> {
	const { geometry, imageOptions } = getImageOptions(root, bounds, options);
	return toJpeg(geometry.viewport, {
		...imageOptions,
		quality: options.quality ?? 0.95
	});
}

/** Returns the exact CSS-pixel dimensions used by image and PDF exports. */
export function getExportSize(
	root: HTMLElement | null,
	bounds: ExportBounds | null,
	options: CaptureOptions = {}
): { width: number; height: number } {
	const { width, height } = getCaptureGeometry(root, bounds, options.padding);
	return { width, height };
}
