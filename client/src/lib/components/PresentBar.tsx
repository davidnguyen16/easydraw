'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useEditorStore } from '@/lib/stores/editor.store';
import { useEditorDoc } from '@/lib/stores/editor-doc.store';
import { useEditorMeta } from '@/lib/stores/editor-meta.store';
import { handleSwitchPage } from '@/lib/flow/editor-persistence';

const PRESENT_BAR_ZONE = 64; // px from the top that keeps/reveals the bar

// Present mode: a minimal top bar floating over the read-only canvas. It's fixed
// (out of flow) so the canvas fills the screen, and slides up 2s after the
// cursor leaves the top edge (Lucidchart-style). Port of Flow.svelte's inline
// present header + its auto-hide/navigation effect.
export default function PresentBar() {
  const rf = useReactFlow();
  const setPresenting = useEditorStore((s) => s.setPresenting);
  const pages = useEditorDoc((s) => s.pages);
  const activePageId = useEditorDoc((s) => s.activePageId);
  const fileName = useEditorMeta((s) => s.fileName);
  const [barVisible, setBarVisible] = useState(true);
  const fitFrame = useRef<number | null>(null);

  const presentPageIndex = Math.max(
    0,
    pages.findIndex((p) => p.id === activePageId),
  );

  // Wait two paint frames (one for React to render the hydrated page, one for
  // xyflow to measure) before fitting; replacing a pending frame prevents rapid
  // clicks from fitting an older page.
  const schedulePresentFit = useCallback(() => {
    if (fitFrame.current !== null) cancelAnimationFrame(fitFrame.current);
    fitFrame.current = requestAnimationFrame(() => {
      fitFrame.current = requestAnimationFrame(() => {
        fitFrame.current = null;
        rf.fitView({ maxZoom: 1 });
      });
    });
  }, [rf]);

  const navigateToPresentPage = useCallback(
    (index: number) => {
      const doc = useEditorDoc.getState();
      const targetPage = doc.pages[index];
      if (!targetPage || targetPage.id === doc.activePageId) return;
      handleSwitchPage(targetPage.id);
      schedulePresentFit();
    },
    [schedulePresentFit],
  );

  const navigatePresentPage = useCallback(
    (direction: -1 | 1) => {
      const doc = useEditorDoc.getState();
      const currentIndex = doc.pages.findIndex((p) => p.id === doc.activePageId);
      if (currentIndex < 0) return;
      navigateToPresentPage(currentIndex + direction);
    },
    [navigateToPresentPage],
  );

  const exitPresent = useCallback(() => {
    if (fitFrame.current !== null) cancelAnimationFrame(fitFrame.current);
    fitFrame.current = null;
    setPresenting(false);
  }, [setPresenting]);

  // Fit once the chrome is hidden and the canvas has grown to fill the screen.
  useEffect(() => {
    schedulePresentFit();
  }, [schedulePresentFit]);

  // Auto-hide bar + keyboard navigation.
  useEffect(() => {
    setBarVisible(true);
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const cancelHide = () => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = null;
    };
    const startHide = () => {
      if (hideTimer) return;
      hideTimer = setTimeout(() => {
        setBarVisible(false);
        hideTimer = null;
      }, 2000);
    };

    const onMove = (e: MouseEvent) => {
      if (e.clientY <= PRESENT_BAR_ZONE) {
        setBarVisible(true);
        cancelHide();
      } else {
        startHide();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitPresent();
        return;
      }
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        navigatePresentPage(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        navigatePresentPage(1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        navigateToPresentPage(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        navigateToPresentPage(useEditorDoc.getState().pages.length - 1);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    startHide();

    return () => {
      cancelHide();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [exitPresent, navigatePresentPage, navigateToPresentPage]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 grid h-[52px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-line-soft bg-white px-4 shadow-sm transition-transform duration-300 ease-out ${
        barVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-2 justify-self-start rounded-md border-none bg-transparent px-2 py-1.5 text-[0.95rem] text-ink-soft hover:bg-surface-hover"
        onClick={exitPresent}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
        <span className="hidden text-[0.8rem] text-ink-muted sm:inline">ESC</span>
      </button>

      <span className="max-w-[40vw] truncate px-4 text-center text-[0.95rem] font-medium text-ink">
        {fileName || 'Untitled'}
      </span>

      <div className="min-w-0 justify-self-end">
        <div
          className="inline-flex h-8 max-w-[240px] items-center overflow-hidden rounded-lg border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          role="group"
          aria-label="Presentation page navigation"
        >
          <button
            type="button"
            className="inline-flex h-full w-8 flex-shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-ink-soft transition-colors hover:bg-surface-hover disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Previous page"
            title="Previous page (Left arrow)"
            disabled={presentPageIndex === 0}
            onClick={() => navigatePresentPage(-1)}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div
            className="flex min-w-0 items-center justify-center gap-2 border-x border-line-soft px-2.5"
            aria-live="polite"
          >
            <span
              className="hidden max-w-[116px] truncate text-[0.8rem] font-medium text-ink md:block"
              title={pages[presentPageIndex]?.name ?? 'Page'}
            >
              {pages[presentPageIndex]?.name ?? 'Page'}
            </span>
            <span className="whitespace-nowrap text-[0.72rem] tabular-nums text-ink-muted">
              {presentPageIndex + 1} / {pages.length}
            </span>
          </div>

          <button
            type="button"
            className="inline-flex h-full w-8 flex-shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-ink-soft transition-colors hover:bg-surface-hover disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Next page"
            title="Next page (Right arrow)"
            disabled={presentPageIndex === pages.length - 1}
            onClick={() => navigatePresentPage(1)}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
