'use client';

import { useEffect, useState } from 'react';
import Flow from '@/lib/flow/Flow';
import { API_URL } from '@/lib/api';
import { useDiagramId } from '@/lib/flow/use-diagram-id';
import { useEditorDoc } from '@/lib/stores/editor-doc.store';
import { useEditorMeta } from '@/lib/stores/editor-meta.store';

// Loads the diagram by id, hydrates the document store, then renders the
// full-screen canvas. Port of (app)/editor/[id]/+page.svelte.
export default function EditorClient() {
  const diagramId = useDiagramId();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  // The editor is full-screen and must NOT scroll (unlike landing/auth/dashboard).
  useEffect(() => {
    document.body.classList.add('editor-mode');
    return () => document.body.classList.remove('editor-mode');
  }, []);

  useEffect(() => {
    if (!diagramId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`${API_URL}/diagrams/${diagramId}`, { credentials: 'include' });
      if (cancelled) return;
      if (!res.ok) {
        setError('Could not load this diagram.');
        return;
      }
      const diagram = await res.json();
      // data JSONB = EditorState. New diagrams have data = {} → not a valid state
      // → start fresh.
      const doc = useEditorDoc.getState();
      const ok = doc.loadEditorStateFromJSON(JSON.stringify(diagram.data));
      if (!ok) doc.resetEditorState();
      useEditorMeta.getState().setFileName(diagram.title);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [diagramId]);

  if (loaded) {
    return (
      <main className="h-screen w-full overflow-hidden">
        <Flow />
      </main>
    );
  }
  if (error) {
    return <div className="flex h-screen items-center justify-center text-ink-muted">{error}</div>;
  }
  return <div className="flex h-screen items-center justify-center text-ink-muted">Loading...</div>;
}
