'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

export default function DeleteDiagramDialog({
  open,
  onClose,
  name = '',
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  name?: string;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const close = () => {
    if (!loading) onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

  const confirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm();
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
      aria-labelledby="delete-diagram-title"
    >
      <button className="absolute inset-0 bg-black/40" onClick={close} aria-label="Close" tabIndex={-1} />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
        <div className="mb-2 flex items-start justify-between">
          <h2 id="delete-diagram-title" className="text-lg font-semibold text-ink">
            Delete diagram?
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

        <p className="text-sm text-ink-muted">
          Are you sure you want to permanently delete this diagram?
        </p>
        <p className="mt-4 text-sm font-semibold text-ink">“{name}”</p>
        <p className="mt-3 text-sm text-ink-muted">This action cannot be undone.</p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={close}
            disabled={loading}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
