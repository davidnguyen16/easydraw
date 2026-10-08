'use client';

import { useEffect, useMemo, useState } from 'react';
import { createEmptyWhiteboardDocument, isWhiteboardDocument } from '@easydraw/pack-whiteboard';
import { createActions, handleShortcut } from './actions';
import { WhiteboardEngine } from './engine/engine';
import ColorPanel from './ColorPanel';
import WhiteboardDialogs from './dialogs';
import WhiteboardFooter from './WhiteboardFooter';
import WhiteboardMenuBar from './WhiteboardMenuBar';
import WhiteboardToolBar from './WhiteboardToolBar';
import WhiteboardViewport from './WhiteboardViewport';
import { useWhiteboard, warnBeforeWhiteboardUnload } from './whiteboard.store';
import WhiteboardPreviewWorkspace from './preview/WhiteboardPreviewWorkspace';
import type { BuiltInPreview } from './preview/built-in-preview';

/**
 * The whiteboard document page: a raster paint editor with the feature set
 * of MS Paint / PaintZ, laid out like the diagram editor — maroon header
 * with menus, toolbar with the active tool's options, tool palette on the
 * left, colours floating on the right, status strip at the bottom.
 */
export default function WhiteboardEditor({ diagramId, title, data, initialHint = '', builtIn = null }: {
  diagramId: string; title: string; data: unknown; initialHint?: string; builtIn?: BuiltInPreview | null;
}) {
  const [ready, setReady] = useState(false);
  // Display preference only: hiding the palette never changes drawing options,
  // document pixels, undo history or autosave state.
  const [showColors, setShowColors] = useState(!builtIn);
  const actions = useMemo(() => createActions(), []);

  // One engine per opened document, loaded from the stored PNG (or blank).
  useEffect(() => {
    const doc = isWhiteboardDocument(data) ? data : createEmptyWhiteboardDocument();
    const engine = new WhiteboardEngine(doc.width, doc.height);
    const store = useWhiteboard.getState();
    store.attach(engine, diagramId, title);
    const unsubscribe = engine.subscribe(() => useWhiteboard.getState().sync());
    engine.onDocumentChange = () => useWhiteboard.getState().markDirty();
    let cancelled = false;
    void engine.loadDocument(doc).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      unsubscribe();
      engine.onDocumentChange = null;
      void useWhiteboard.getState().detach();
      setReady(false);
    };
  }, [diagramId, title, data]);

  useEffect(() => {
    window.addEventListener('beforeunload', warnBeforeWhiteboardUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeWhiteboardUnload);
  }, []);

  // Keyboard shortcuts and system paste. Typing in a field is left alone,
  // except for the shortcuts that only make sense while editing text.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-whiteboard-preview]')) return;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (typing) return;
      if (useWhiteboard.getState().dialog) return;
      if (handleShortcut(e, actions)) e.preventDefault();
    };
    const onPaste = (e: ClipboardEvent) => {
      const engine = useWhiteboard.getState().engine;
      const target = e.target as HTMLElement | null;
      if (!engine || target?.closest('[data-whiteboard-preview], input, textarea, select, [contenteditable="true"]')) return;
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (!file) {
        // Nothing pasteable from the system: fall back to the last copy made here.
        if (engine.pasteFromClipboard(useWhiteboard.getState().viewOrigin)) e.preventDefault();
        return;
      }
      e.preventDefault();
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        engine.paste(image, useWhiteboard.getState().viewOrigin);
      };
      image.src = url;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, [actions]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-panel">
      <WhiteboardMenuBar actions={actions} />
      <div className="shrink-0 overflow-x-auto">
        <WhiteboardToolBar showColors={showColors} onToggleColors={() => setShowColors((visible) => !visible)} />
      </div>
      <WhiteboardPreviewWorkspace key={diagramId} ready={ready} initialHint={initialHint} builtIn={builtIn}>
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {ready ? <WhiteboardViewport fitOnLoad={Boolean(builtIn)} /> : <div className="flex flex-1 items-center justify-center text-ink-muted">Loading whiteboard…</div>}
          <ColorPanel visible={showColors} />
        </div>
      </WhiteboardPreviewWorkspace>
      <WhiteboardFooter onShortcuts={actions.shortcuts} />
      <WhiteboardDialogs />
    </div>
  );
}
