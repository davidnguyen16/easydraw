import { create } from 'zustand';
import type { ImportWarning } from '@easydraw/diagram-import';

/**
 * Outcome of the last File › Import, shown as a dismissible notice over the
 * canvas. Importing is lossy by nature, so the editor opens the file and
 * lists what to check instead of refusing it or hiding the loss.
 */
export type ImportReport =
  | {
      ok: true;
      fileName: string;
      /** Display name of the source format, e.g. "draw.io". */
      formatLabel: string;
      stats: { pages: number; nodes: number; edges: number };
      warnings: ImportWarning[];
    }
  | { ok: false; fileName: string; error: string };

type ImportReportState = {
  report: ImportReport | null;
  show: (report: ImportReport) => void;
  dismiss: () => void;
};

export const useImportReport = create<ImportReportState>((set) => ({
  report: null,
  show: (report) => set({ report }),
  dismiss: () => set({ report: null }),
}));
