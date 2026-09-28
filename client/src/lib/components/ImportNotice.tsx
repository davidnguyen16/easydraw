'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, X } from 'lucide-react';
import { useImportReport } from '@/lib/stores/import-report.store';

function count(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * Floating outcome of File › Import over the canvas. Imports are lossy, so
 * the honest UX is: open the file, say what landed, and list what to check
 * — folded by default so a clean import is one quiet line.
 */
export default function ImportNotice() {
  const report = useImportReport((s) => s.report);
  const dismiss = useImportReport((s) => s.dismiss);
  // Expanded state belongs to one report: a new import starts folded again.
  const [openFor, setOpenFor] = useState<typeof report>(null);
  if (!report) return null;
  const open = openFor === report;
  const setOpen = (next: (prev: boolean) => boolean) => setOpenFor(next(open) ? report : null);

  const failed = !report.ok;
  const notes = report.ok ? report.warnings : [];

  return (
    <div
      role={failed ? 'alert' : 'status'}
      className={`absolute bottom-4 left-1/2 z-30 w-[min(640px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border bg-white/97 shadow-lg backdrop-blur ${
        failed ? 'border-[#f2c9c9]' : 'border-[#e7e0d6]'
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {failed
          ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#a6192e]" aria-hidden="true" />
          : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#2e7d4f]" aria-hidden="true" />}
        <div className="min-w-0 flex-1 text-[13px] leading-5 text-[#423c35]">
          {report.ok ? (
            <>
              <p>
                Imported <span className="font-semibold">{report.fileName}</span> from {report.formatLabel} —{' '}
                {count(report.stats.nodes, 'shape')}, {count(report.stats.edges, 'connection')}
                {report.stats.pages > 1 ? ` on ${count(report.stats.pages, 'page')}` : ''}.
              </p>
              {notes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  aria-expanded={open}
                  className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded border-none bg-transparent p-0 text-[12px] font-medium text-[#a6192e] hover:underline"
                >
                  {count(notes.length, 'thing')} to check
                  <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            <p>
              Couldn&apos;t import <span className="font-semibold">{report.fileName}</span>: {report.error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[#756d62] hover:bg-[#f3efe9]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {report.ok && open && notes.length > 0 && (
        <ul className="max-h-48 space-y-1.5 overflow-auto border-t border-[#efe9e1] px-4 py-3 text-[12px] leading-5 text-[#5b544c]">
          {notes.map((note) => (
            <li key={note.code + note.message} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9b8a8]" aria-hidden="true" />
              <span>{note.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
