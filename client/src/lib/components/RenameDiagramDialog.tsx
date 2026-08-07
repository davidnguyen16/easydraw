'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

export default function RenameDiagramDialog({
  open,
  onClose,
  currentName = '',
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  currentName?: string;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmed = name.trim();
  // Enabled only when there's a real, different name.
  const changed = trimmed !== '' && trimmed !== currentName;

  const close = () => {
    if (!loading) onClose();
  };

  // Reset to the current name + focus/select each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName(currentName);
    setLoading(false);
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [open, currentName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

  const save = async () => {
    if (!changed || loading) return;
    setLoading(true);
    try {
      await onSave(trimmed);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-diagram-title"
    >
      <button className="absolute inset-0 bg-black/40" onClick={close} aria-label="Close" tabIndex={-1} />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <h2 id="rename-diagram-title" className="text-lg font-semibold text-ink">
            Rename diagram
          </h2>
          <button
            onClick={close}
            disabled={loading}
            aria-label="Close"
            className="-mt-1 -mr-1 rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="rename-input" className="text-sm font-medium text-ink">
            Name
          </label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            id="rename-input"
            maxLength={100}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              }
            }}
            className="w-full rounded-lg border border-line px-3 py-2.5 text-ink outline-none focus:border-mq-red focus:ring-1 focus:ring-mq-red disabled:opacity-60"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={close}
            disabled={loading}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!changed || loading}
            className="flex items-center gap-2 rounded-lg bg-mq-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mq-red-hover disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
