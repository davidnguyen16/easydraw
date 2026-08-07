'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, Minus, X } from 'lucide-react';
import MarkerPreview from './MarkerPreview';
import { MARKER_CATEGORIES, getMarkersByCategory, type MarkerCategory } from '@/lib/flow/edges/markers';
import { useMarkerPalette } from '@/lib/stores/markers.store';

// "Line endings" dialog (opened from the More button in the connection panel's
// Start/End dropdowns). Edits a local DRAFT; Apply commits it to the marker
// palette store, Cancel / X / Escape / backdrop discard. (Port of
// LineEndingsDialog.svelte.)
interface Props {
  onClose: () => void;
}

function CheckBox({ checked, indeterminate }: { checked: boolean; indeterminate: boolean }) {
  return (
    <span
      className={`inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] text-white ${
        checked || indeterminate ? 'bg-mq-red' : 'bg-line-dropdown'
      }`}
    >
      {indeterminate ? (
        <Minus size={12} strokeWidth={3} />
      ) : checked ? (
        <Check size={12} strokeWidth={3} />
      ) : null}
    </span>
  );
}

export default function LineEndingsDialog({ onClose }: Props) {
  const enabled = useMarkerPalette((s) => s.enabled);
  const setEnabledMarkers = useMarkerPalette((s) => s.setEnabledMarkers);

  const [activeCategory, setActiveCategory] = useState<'all' | MarkerCategory>('all');
  const [draft, setDraft] = useState<string[]>(() => [...enabled]);
  const listRef = useRef<HTMLDivElement>(null);

  const visible = getMarkersByCategory(activeCategory);
  const allChecked = visible.every((d) => draft.includes(d.id));
  const someChecked = visible.some((d) => draft.includes(d.id));

  function toggle(id: string) {
    setDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Select-all operates on the rows the current category shows.
  function toggleAll() {
    const ids = visible.map((d) => d.id as string);
    setDraft((prev) =>
      allChecked ? prev.filter((x) => !ids.includes(x)) : [...new Set([...prev, ...ids])],
    );
  }

  function apply() {
    setEnabledMarkers(draft);
    onClose();
  }

  function scrollDown() {
    listRef.current?.scrollBy({ top: 220, behavior: 'smooth' });
  }

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeydown, true);
    return () => window.removeEventListener('keydown', onKeydown, true);
  }, [onClose]);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/45"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[calc(100vh-64px)] w-[640px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
        role="dialog"
        aria-modal="true"
        aria-label="Line endings"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line-soft px-5 py-4">
          <h2 className="m-0 text-[1.15rem] font-semibold text-ink">Line endings</h2>
          <button
            type="button"
            className="inline-flex cursor-pointer rounded-md p-1 text-ink-soft hover:bg-surface-hover hover:text-ink"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <nav
            className="flex w-[140px] shrink-0 flex-col overflow-y-auto border-r border-line-soft py-2.5"
            aria-label="Line ending categories"
          >
            {MARKER_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`cursor-pointer border-l-[3px] px-4 py-2.5 text-left text-[0.9rem] ${
                  activeCategory === c.id
                    ? 'border-l-mq-red bg-mq-pink font-semibold text-mq-red'
                    : 'border-l-transparent text-ink-soft hover:bg-panel'
                }`}
                onClick={() => setActiveCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </nav>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <button
              type="button"
              className="flex shrink-0 cursor-pointer items-center gap-3 border-b border-line-soft px-5 py-3.5 text-[0.92rem] text-ink"
              onClick={toggleAll}
            >
              <CheckBox checked={allChecked} indeterminate={someChecked && !allChecked} />
              Select all
            </button>
            <div ref={listRef} className="max-h-[380px] min-h-[200px] flex-1 overflow-y-auto py-2">
              {visible.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-3.5 px-5 py-2.5 hover:bg-panel"
                  aria-pressed={draft.includes(d.id)}
                  title={d.label}
                  onClick={() => toggle(d.id)}
                >
                  <CheckBox checked={draft.includes(d.id)} indeterminate={false} />
                  <MarkerPreview kind={d.id} end="end" width={330} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="relative flex shrink-0 items-center justify-center border-t border-line-soft px-5 py-3">
          <button
            type="button"
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-line bg-white text-ink-soft hover:bg-panel"
            aria-label="Scroll list down"
            onClick={scrollDown}
          >
            <ArrowDown size={16} />
          </button>
          <div className="absolute right-5 flex gap-2.5">
            <button
              type="button"
              className="cursor-pointer rounded-lg border border-line bg-white px-[18px] py-[9px] text-[0.88rem] text-ink-soft hover:bg-panel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-lg border border-mq-red bg-mq-red px-5 py-[9px] text-[0.88rem] font-semibold text-white hover:bg-mq-red-hover"
              onClick={apply}
            >
              Apply
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
