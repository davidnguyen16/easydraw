'use client';

import { requestInitialThumbnail } from '@/lib/flow/editor-persistence';
import { useEffect, useState } from 'react';
import Flow from '@/lib/flow/Flow';
import { API_URL } from '@/lib/api';
import { useDiagramId } from '@/lib/flow/use-diagram-id';
import { useEditorDoc } from '@/lib/stores/editor-doc.store';
import { useEditorMeta } from '@/lib/stores/editor-meta.store';
import { useEditorStore } from '@/lib/stores/editor.store';

import WhiteboardEditor from '@/lib/whiteboard/WhiteboardEditor';
import { WHITEBOARD_TYPE } from '@/lib/dashboard/workspaces';
import { DATA_CENTRE_WHITEBOARD_SAMPLE } from '@/lib/whiteboard/samples/data-centre';

// Loads the diagram by id, hydrates the document store, then renders the
// full-screen canvas. Port of (app)/editor/[id]/+page.svelte.
export default function EditorClient() {
  const diagramId = useDiagramId();
  const [loaded, setLoaded] = useState<{ id: string; revision: number } | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  // A whiteboard bypasses the 2D canvas and its stores entirely: its data is
  // a painted board, not an editor state.
  const [special, setSpecial] = useState<{ kind: 'whiteboard'; id: string; title: string; data: unknown; initialHint: string } | null>(null);

  // The editor is full-screen and must NOT scroll (unlike landing/auth/dashboard).
  useEffect(() => {
    document.body.classList.add('editor-mode');
    return () => document.body.classList.remove('editor-mode');
  }, []);

  useEffect(() => {
    if (!diagramId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/diagrams/${diagramId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Could not load this diagram.');
        const diagram = await res.json();
        if (cancelled) return;
        if (diagram.type === WHITEBOARD_TYPE) {
          const sampleId = new URLSearchParams(window.location.search).get('sample');
          const initialHint = sampleId === DATA_CENTRE_WHITEBOARD_SAMPLE.id ? DATA_CENTRE_WHITEBOARD_SAMPLE.prompt : '';
          setSpecial({ kind: 'whiteboard', id: diagramId, title: diagram.title, data: diagram.data, initialHint });
        } else {
          // data JSONB = EditorState. New diagrams have data = {}.
          const doc = useEditorDoc.getState();
          const ok = doc.loadEditorStateFromJSON(JSON.stringify(diagram.data));
          if (!ok) doc.resetEditorState();
          useEditorMeta.getState().setFileName(diagram.title);
          if (!diagram.thumbnailAt) requestInitialThumbnail(diagramId);
          // A shared sample link may request an initial viewpoint. This is UI
          // state only: subsequent 2D/3D switches never refetch or convert data.
          const initialView = new URLSearchParams(window.location.search).get('view');
          useEditorStore.getState().setViewMode(initialView === '3d' ? '3d' : '2d');
          setSpecial(null);
        }
        setLoaded((previous) => ({ id: diagramId, revision: (previous?.revision ?? 0) + 1 }));
      } catch {
        if (!cancelled) setError({ id: diagramId, message: 'Could not load this diagram.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diagramId]);

  if (loaded?.id === diagramId && special?.kind === 'whiteboard') {
    return <WhiteboardEditor key={special.id} diagramId={special.id} title={special.title} data={special.data} initialHint={special.initialHint} />;
  }
  if (loaded?.id === diagramId) {
    return (
      <main className="h-screen w-full overflow-hidden">
        <Flow key={`${loaded.id}:${loaded.revision}`} />
      </main>
    );
  }
  if (error?.id === diagramId) {
    return <div className="flex h-screen items-center justify-center text-ink-muted">{error.message}</div>;
  }
  return <div className="flex h-screen items-center justify-center text-ink-muted">Loading...</div>;
}
