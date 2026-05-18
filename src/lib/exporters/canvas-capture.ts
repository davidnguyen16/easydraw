/**
 * Capture the SvelteFlow viewport as an image data URL.
 *
 * Why we target `.svelte-flow__viewport` instead of the whole canvas wrapper:
 * the viewport holds nodes + edges at the user's current pan/zoom, without
 * the surrounding chrome (background pattern, panels, etc.) bleeding in.
 *
 * `htmlToImage` walks the DOM, inlines CSS, embeds web fonts as data URLs,
 * and rasterizes the result. Returns a PNG or JPEG depending on the type arg.
 */
import { toPng, toJpeg } from 'html-to-image';

export interface CaptureOptions {
    backgroundColor?: string;
    pixelRatio?: number;
    quality?: number;
}

const DEFAULTS: Required<Pick<CaptureOptions, 'backgroundColor' | 'pixelRatio'>> = {
    backgroundColor: '#ffffff',
    pixelRatio: 2
};

function pickViewport(root: HTMLElement | null): HTMLElement {
    if (!root) throw new Error('Canvas element is not mounted');
    const viewport = root.querySelector<HTMLElement>('.svelte-flow__viewport');
    if (!viewport) throw new Error('Could not find SvelteFlow viewport to capture');
    return viewport;
}

export async function captureAsPng(
    root: HTMLElement | null,
    options: CaptureOptions = {}
): Promise<string> {
    const viewport = pickViewport(root);
    return toPng(viewport, {
        backgroundColor: options.backgroundColor ?? DEFAULTS.backgroundColor,
        pixelRatio: options.pixelRatio ?? DEFAULTS.pixelRatio,
        cacheBust: true
    });
}

export async function captureAsJpeg(
    root: HTMLElement | null,
    options: CaptureOptions = {}
): Promise<string> {
    const viewport = pickViewport(root);
    return toJpeg(viewport, {
        backgroundColor: options.backgroundColor ?? DEFAULTS.backgroundColor,
        pixelRatio: options.pixelRatio ?? DEFAULTS.pixelRatio,
        quality: options.quality ?? 0.95,
        cacheBust: true
    });
}

/** Measures the rendered viewport in CSS pixels — useful for sizing PDFs. */
export function getViewportSize(root: HTMLElement | null): { width: number; height: number } {
    const viewport = pickViewport(root);
    const rect = viewport.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
}
