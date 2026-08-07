'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { DIAGRAM_TYPES, type DiagramType } from '@/lib/diagram-types';

const MAX_LENGTH = 100;

export default function NewDiagramDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; type: DiagramType }) => Promise<void> | void;
}) {
  const [name, setName] = useState('Untitled Diagram');
  const [type, setType] = useState<DiagramType>('erd');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmed = name.trim();
  const isValid = trimmed.length > 0;
  const showError = touched && !isValid;

  const close = () => {
    if (!loading) onClose();
  };

  // Reset fields + focus/select the name each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName('Untitled Diagram');
    setType('erd');
    setTouched(false);
    setLoading(false);
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

  const handleCreate = async () => {
    setTouched(true);
    if (!isValid || loading) return;
    setLoading(true);
    try {
      await onCreate({ name: trimmed, type });
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreate();
              }
            }}
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
          <span className="mb-1.5 block text-sm font-medium text-ink">Type</span>
          <div
            className="grid grid-cols-2 gap-2 max-[420px]:grid-cols-1"
            role="radiogroup"
            aria-label="Diagram type"
          >
            {DIAGRAM_TYPES.map((dt) => {
              const selected = type === dt.value;
              const Icon = dt.icon;
              return (
                <button
                  key={dt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setType(dt.value)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? 'border-mq-red bg-mq-red/5 ring-1 ring-mq-red/20'
                      : 'border-line hover:bg-surface-hover'
                  }`}
                >
                  <Icon
                    size={20}
                    className={`mt-0.5 flex-shrink-0 ${selected ? 'text-mq-red' : 'text-ink-muted'}`}
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${selected ? 'text-mq-red' : 'text-ink'}`}>
                      {dt.label}
                    </p>
                    <p className="text-xs text-ink-muted">{dt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
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
