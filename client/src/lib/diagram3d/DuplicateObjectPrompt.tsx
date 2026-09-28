'use client';

import { AlertTriangle } from 'lucide-react';

/**
 * Shown when an imported file is the object the account already holds — same
 * name, same shape. Importing would silently leave two identical entries, so
 * the import waits here until the person says which they meant.
 */
export default function DuplicateObjectPrompt({ name, library, busy, onImportAnyway, onCancel }: {
  name: string;
  /** The library the existing copy sits in. */
  library: string;
  busy?: boolean;
  onImportAnyway: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="alertdialog" aria-label="Object already uploaded" className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="m-0 flex items-start gap-2 text-xs leading-relaxed text-ink">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
        <span>
          <span className="font-semibold">“{name}” is already in your libraries.</span>{' '}
          The copy in <span className="font-semibold">{library}</span> has the same name and the same shape,
          so importing makes a second, identical entry.
        </span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={busy}
          className="rounded border border-line bg-white px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-surface-hover disabled:opacity-40"
          onClick={onCancel}>Cancel</button>
        <button type="button" disabled={busy}
          className="rounded border border-amber-400 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-40"
          onClick={onImportAnyway}>Import anyway</button>
      </div>
    </div>
  );
}
