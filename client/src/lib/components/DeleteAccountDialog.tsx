'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

export default function DeleteAccountDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const confirmInputRef = useRef<HTMLInputElement | null>(null);

  const canDelete = confirmText === 'DELETE' && !isDeleting;

  // Reset stale confirmation/error state and focus the destructive-action guard
  // every time the dialog opens (and clear on close).
  useEffect(() => {
    if (open) {
      setConfirmText('');
      setDeleteError(null);
      setIsDeleting(false);
      const id = requestAnimationFrame(() => confirmInputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    setConfirmText('');
    setDeleteError(null);
  }, [open]);

  const close = () => {
    if (!isDeleting) onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isDeleting]);

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canDelete) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onConfirm();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Could not delete account. Please try again.',
      );
      setIsDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      aria-describedby="delete-account-description"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={close}
        disabled={isDeleting}
        aria-label="Close dialog"
        tabIndex={-1}
      />

      <form
        onSubmit={confirm}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-xl"
      >
        <div>
          <h2 id="delete-account-title" className="text-lg font-semibold text-ink">
            Delete account permanently?
          </h2>
          <p id="delete-account-description" className="mt-2 text-sm leading-6 text-ink-muted">
            This will delete your account and saved diagrams from EasyDraw, sign you out, and clear
            EasyDraw data stored by this browser. This action cannot be undone.
          </p>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-lg bg-panel p-3 text-xs text-ink-muted">
          <Download size={15} className="mt-0.5 flex-shrink-0" />
          <span>
            Need your data? Export your diagrams from the dashboard before deleting your account.
            Limited backup or security records may remain as described in our{' '}
            <a
              href="/privacy#retention"
              target="_blank"
              rel="noreferrer"
              className="text-mq-red underline underline-offset-2"
            >
              Privacy Policy
            </a>
            .
          </span>
        </div>

        <div className="mt-5">
          <label htmlFor="confirm-delete" className="block text-xs text-ink-muted">
            Type <span className="font-semibold text-ink">DELETE</span> to confirm
          </label>
          <input
            ref={confirmInputRef}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            id="confirm-delete"
            type="text"
            placeholder="DELETE"
            autoComplete="off"
            disabled={isDeleting}
            aria-invalid={deleteError !== null}
            aria-describedby={deleteError ? 'delete-account-error' : undefined}
            className="mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red disabled:cursor-not-allowed disabled:opacity-60"
          />
          {deleteError && (
            <p id="delete-account-error" className="mt-2 text-xs text-red-600" role="alert">
              {deleteError}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <button
            type="button"
            onClick={close}
            disabled={isDeleting}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canDelete}
            className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete permanently'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
