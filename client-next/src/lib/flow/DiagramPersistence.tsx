'use client';

import { useEffect } from 'react';
import { useFlowStore } from '@/lib/flow/flow-store';
import { useEditorMeta } from '@/lib/stores/editor-meta.store';
import { useEditorDoc, computeVisibleUnsavedPageIds } from '@/lib/stores/editor-doc.store';
import { recordSnapshot, isApplyingHistory } from '@/lib/stores/history.store';
import {
  hydrateCanvasFromStore,
  getIsHydrating,
  getCanvasPageId,
  getBaselineSignature,
  getSavedMetaSignature,
  markSavedMetaInitial,
  createCanvasSignature,
  createMetaSignature,
  scheduleAutosave,
} from '@/lib/flow/editor-persistence';

// Runs the editor's reactive persistence (Flow.svelte's $effects): canvas-dirty
// marking, debounced history recording, and debounced cloud autosave. Renders
// nothing. Mounted once the diagram doc is loaded (so the initial hydrate reads
// real pages, not the empty default).
export default function DiagramPersistence({ diagramId }: { diagramId: string }) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const fileName = useEditorMeta((s) => s.fileName);
  const status = useEditorMeta((s) => s.status);
  const markCanvasDirtyPage = useEditorDoc((s) => s.markCanvasDirtyPage);
  const clearCanvasDirtyPage = useEditorDoc((s) => s.clearCanvasDirtyPage);

  // Hydrate the canvas from the active page once on mount.
  useEffect(() => {
    hydrateCanvasFromStore();
  }, []);

  // Warn before leaving with unsaved changes (browser close / refresh).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (computeVisibleUnsavedPageIds(useEditorDoc.getState()).length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Canvas change → dirty marker + debounced history + debounced autosave.
  useEffect(() => {
    const pageId = getCanvasPageId();
    if (getIsHydrating() || !pageId) return;

    const sig = createCanvasSignature(nodes, edges);
    if (sig !== getBaselineSignature()) markCanvasDirtyPage(pageId);
    else clearCanvasDirtyPage(pageId);

    let historyTimer: ReturnType<typeof setTimeout> | undefined;
    if (!isApplyingHistory()) {
      historyTimer = setTimeout(() => recordSnapshot(sig), 350);
    }

    if (sig !== getBaselineSignature()) scheduleAutosave(diagramId, createMetaSignature());

    return () => {
      if (historyTimer) clearTimeout(historyTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Metadata (title / status) change → debounced autosave, independent of canvas.
  useEffect(() => {
    const metaSignature = createMetaSignature();
    if (getIsHydrating() || !getCanvasPageId()) return;
    if (getSavedMetaSignature() === null) {
      markSavedMetaInitial();
      return;
    }
    if (metaSignature === getSavedMetaSignature()) return;
    scheduleAutosave(diagramId, metaSignature);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName, status]);

  return null;
}
