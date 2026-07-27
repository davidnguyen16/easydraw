/**
 * Exporter contract.
 *
 * Each format (PNG, JPEG, PDF, .easydraw, ...) implements this interface as a
 * single self-contained module. New formats are added by:
 *   1. Creating a new file in this directory.
 *   2. Registering it in `index.ts`.
 *
 * The exporter is given a context object instead of pulling globals so it can
 * be unit-tested in isolation.
 */
export interface ExportContext {
	/** File name (without extension). The exporter appends its own extension. */
	fileName: string;
	/** Serialized editor state — useful for text-based formats like .easydraw. */
	serializedState: string;
	/** The DOM element to rasterize for image/PDF formats. */
	canvasElement: HTMLElement | null;
	/** Full diagram bounds in flow coordinates, independent of the visible viewport. */
	diagramBounds: ExportBounds | null;
}

export interface ExportBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Exporter {
	/** Stable id used by the registry (e.g. "png"). */
	id: string;
	/** Human-readable name shown in the menu (e.g. "PNG"). */
	label: string;
	/** File extension including the leading dot (e.g. ".png"). */
	extension: string;
	/** MIME type used when constructing the download blob. */
	mimeType: string;
	/** Performs the export. Should throw on unrecoverable error. */
	run: (context: ExportContext) => Promise<void>;
}
