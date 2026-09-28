'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const MAX_LENGTH = 100;
const MAX_CATEGORY = 40;

/** Offered as completions; the field takes any label. */
const DEFAULT_CATEGORIES = ['ERD', 'UML', 'Flowchart', 'DFD', 'Network', 'Architecture', 'Data centre', 'Office'];

export interface NewDiagramPayload {
  name: string;
  /** Free label chosen by the user, or null for none. */
  category: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: NewDiagramPayload) => Promise<void> | void;
  /** Labels the user already uses, shown first in the completions. */
  suggestions?: readonly string[];
}

/** Mounted only while open, so every opening starts from fresh fields. */
export default function NewDiagramDialog({ open, ...props }: Props) {
  return open ? <NewDiagramForm {...props} /> : null;
}

function NewDiagramForm({ onClose, onCreate, suggestions = [] }: Omit<Props, 'open'>) {
  const [name, setName] = useState('Untitled Diagram');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmed = name.trim();
  const isValid = trimmed.length > 0;
  const showError = touched && !isValid;
  const options = [...new Set([...suggestions, ...DEFAULT_CATEGORIES].map((s) => s.trim()).filter(Boolean))];

  const close = () => {
    if (!loading) onClose();
  };

  // Focus and select the name on open.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loading, onClose]);

  const handleCreate = async () => {
    setTouched(true);
    if (!isValid || loading) return;
    setLoading(true);
    try {
      await onCreate({ name: trimmed, category: category.trim() || null });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleCreate();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-diagram-title"
    >
      <button className="absolute inset-0 bg-black/40" onClick={close} aria-label="Close" tabIndex={-1} />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="new-diagram-title" className="text-lg font-semibold text-ink">
            New Diagram
          </h2>
          <button
            onClick={close}
            aria-label="Close"
            className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-5">
          <label htmlFor="diagram-name" className="mb-1.5 block text-sm font-medium text-ink">
            Name
          </label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            id="diagram-name"
            maxLength={MAX_LENGTH}
            placeholder="My Diagram"
            onBlur={() => setTouched(true)}
            onKeyDown={onEnter}
            aria-invalid={showError}
            className={`w-full rounded-lg border px-3 py-2.5 text-ink outline-none placeholder:text-ink-muted focus:ring-1 ${
              showError
                ? 'border-mq-red focus:border-mq-red focus:ring-mq-red'
                : 'border-line focus:border-mq-red focus:ring-mq-red'
            }`}
          />
          {showError && <p className="mt-1 text-xs text-mq-red">Diagram name is required.</p>}
        </div>

        <div className="mb-6">
          <label htmlFor="diagram-category" className="mb-1.5 block text-sm font-medium text-ink">
            Type <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id="diagram-category"
            list="diagram-category-options"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            maxLength={MAX_CATEGORY}
            placeholder="e.g. ERD, Flowchart, Network — or your own"
            onKeyDown={onEnter}
            autoComplete="off"
            className="w-full rounded-lg border border-line px-3 py-2.5 text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
          />
          <datalist id="diagram-category-options">
            {options.map((option) => <option key={option} value={option} />)}
          </datalist>
          <p className="mt-1 text-xs text-ink-muted">A label for your dashboard. Any name works; it never limits which shapes you can use.</p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={loading}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!isValid || loading}
            className="rounded-lg bg-mq-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-mq-red-hover disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
