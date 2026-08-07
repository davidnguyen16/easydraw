/**
 * Registry of available export formats.
 *
 * Order in this array drives the order in the File → Export submenu. To add a
 * new format: create a module exporting an `Exporter`, then add it to the array
 * below. No menu code changes needed.
 */
import { easydrawExporter } from './easydraw';
import { jpegExporter } from './jpeg';
import { pdfExporter } from './pdf';
import { pngExporter } from './png';
import type { ExportContext, Exporter } from './types';

export const EXPORTERS: readonly Exporter[] = [
  jpegExporter,
  pngExporter,
  pdfExporter,
  easydrawExporter,
] as const;

export function getExporter(id: string): Exporter | undefined {
  return EXPORTERS.find((e) => e.id === id);
}

export type { Exporter, ExportContext };
export { parseEasyDraw, serializeEasyDraw } from './easydraw';
