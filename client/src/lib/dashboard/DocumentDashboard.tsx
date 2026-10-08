'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, Check, ChevronDown, FilePlus, Plus, Search } from 'lucide-react';
import { API_URL } from '@/lib/api';
import NewDiagramDialog, { type NewDiagramPayload } from '@/lib/components/NewDiagramDialog';
import DeleteDiagramDialog from '@/lib/components/DeleteDiagramDialog';
import RenameDiagramDialog from '@/lib/components/RenameDiagramDialog';
import type { DiagramStatus } from '@/lib/stores/editor-meta.store';
import { useAuthStore } from '@/lib/stores/auth.store';
import DashboardShell from './DashboardShell';
import DocumentCard, { type DashboardDocument } from './DocumentCard';
import WorkspaceSwitch from './WorkspaceSwitch';
import { SAMPLES, SampleCard, type SampleDefinition } from './samples';
import { templatesApi, templateThumbnailUrl, type SampleTemplate } from './templates';
import { getWorkspace, WHITEBOARD_TYPE, type WorkspaceId } from './workspaces';
import { createDataCentreWhiteboardDocument, DATA_CENTRE_WHITEBOARD_SAMPLE } from '@/lib/whiteboard/samples/data-centre';
import { createGeometryWhiteboardDocument, GEOMETRY_WHITEBOARD_SAMPLE } from '@/lib/whiteboard/samples/geometry';

type SortKey = 'recent' | 'oldest' | 'name-asc' | 'name-desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'oldest', label: 'Least recently updated' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
];

function normalizeStatus(status: unknown): DiagramStatus {
  return status === 'complete' || status === 'archived' ? status : 'draft';
}

function byKey(key: SortKey) {
  return (a: DashboardDocument, b: DashboardDocument) => {
    switch (key) {
      case 'oldest':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case 'name-asc':
        return a.title.localeCompare(b.title);
      case 'name-desc':
        return b.title.localeCompare(a.title);
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  };
}

async function api(path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
}

/**
 * One workspace's document list: the same page for diagrams and whiteboards,
 * differing only in which `type`s it shows, its copy, and how a new
 * document starts (diagrams pick a kind in a dialog; a whiteboard is created
 * on the spot and opened).
 */
export default function DocumentDashboard({ workspace: workspaceId }: { workspace: WorkspaceId }) {
  const workspace = getWorkspace(workspaceId);
  const router = useRouter();

  const isAdmin = useAuthStore((state) => state.user?.role === 'admin');
  const [documents, setDocuments] = useState<DashboardDocument[]>([]);
  const [templates, setTemplates] = useState<SampleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  // The chosen sample stays pending until the editor opens or creation fails.
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [openingSample, startSampleNavigation] = useTransition();
  const [sampleError, setSampleError] = useState<{ id: string; message: string } | null>(null);
  const sampleRequest = useRef(false);
  const [sampleMenuFor, setSampleMenuFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DashboardDocument | null>(null);
  const [renameTarget, setRenameTarget] = useState<DashboardDocument | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api('/diagrams');
        if (!res.ok || cancelled) return;
        const all = (await res.json()) as (Omit<DashboardDocument, 'status' | 'category' | 'thumbnailAt'> & { status?: unknown; category?: string | null; thumbnailAt?: string | null })[];
        setDocuments(
          all.filter((d) => workspace.includes(d.type)).map((d) => ({ ...d, category: d.category ?? null, thumbnailAt: d.thumbnailAt ?? null, status: normalizeStatus(d.status) })),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  // Samples published by admins; a failure here just leaves the gallery with the built-in ones.
  useEffect(() => {
    let cancelled = false;
    templatesApi.list().then((list) => { if (!cancelled) setTemplates(list); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const query = search.trim().toLowerCase();
  const visible = documents
    .filter((d) => d.title.toLowerCase().includes(query) || (d.category ?? '').toLowerCase().includes(query))
    .sort(byKey(sortBy));
  const publishedSamples = templates.filter((template) => workspace.includes(template.type));
  const categorySuggestions = [...new Set(documents.map((d) => d.category).filter((c): c is string => Boolean(c)))];

  const createDocument = async (title: string, type: string, data?: unknown, category?: string | null) => {
    const res = await api('/diagrams', { method: 'POST', body: JSON.stringify({ title, type, data, category: category ?? undefined }) });
    if (!res.ok) return null;
    return (await res.json()) as { id: string; title: string; type: string; category: string | null; thumbnailAt: string | null; updatedAt: string };
  };

  const startNew = async () => {
    if (workspace.id === 'diagram') {
      setNewDialogOpen(true);
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const created = await createDocument('Untitled Whiteboard', WHITEBOARD_TYPE);
      if (created) router.push(`/editor/${created.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateDiagram = async ({ name, category }: NewDiagramPayload) => {
    const created = await createDocument(name, 'diagram', undefined, category);
    if (created) router.push(`/editor/${created.id}`);
  };

  /** Each sample opens as a private copy owned by the signed-in account. */
  const startFromSample = async (id: string, make: () => Promise<{ id: string } | null>, query = '') => {
    if (sampleRequest.current || openingSample) return;
    sampleRequest.current = true;
    setActiveSample(id);
    setSampleError(null);
    try {
      const created = await make();
      if (!created?.id) throw new Error('Sample creation failed');
      startSampleNavigation(() => router.push(`/editor/${encodeURIComponent(created.id)}${query}`));
    } catch (error) {
      setSampleError({ id, message: error instanceof Error && error.message !== 'Sample creation failed' ? error.message : 'Could not create the sample. Please try again.' });
      setActiveSample(null);
    } finally {
      sampleRequest.current = false;
    }
  };

  const handleCreateSample = (sample: SampleDefinition) => startFromSample(sample.id, async () => {
    const { title, create } = await sample.load();
    return createDocument(title, 'diagram', create(), sample.category);
  }, '?view=3d');

  const handleCreateWhiteboardSample = () => startFromSample(DATA_CENTRE_WHITEBOARD_SAMPLE.id, async () => {
    const data = await createDataCentreWhiteboardDocument();
    return createDocument(DATA_CENTRE_WHITEBOARD_SAMPLE.title, WHITEBOARD_TYPE, data, DATA_CENTRE_WHITEBOARD_SAMPLE.category);
  });

  const handleCreateGeometrySample = () => startFromSample(GEOMETRY_WHITEBOARD_SAMPLE.id, async () => {
    const data = await createGeometryWhiteboardDocument();
    return createDocument(GEOMETRY_WHITEBOARD_SAMPLE.title, WHITEBOARD_TYPE, data, GEOMETRY_WHITEBOARD_SAMPLE.category);
  });

  const handleUseTemplate = (template: SampleTemplate) => startFromSample(template.id, () => templatesApi.use(template.id));

  const publishSample = async (doc: DashboardDocument) => {
    setMenuFor(null);
    setNotice(null);
    try {
      const created = await templatesApi.publish(doc.id);
      setTemplates((current) => [...current, created]);
      setNotice(`“${created.title}” is now a sample for every account.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not publish the sample.');
    }
  };

  const removeSample = async (template: SampleTemplate) => {
    setSampleMenuFor(null);
    if (!window.confirm(`Remove the sample “${template.title}”? Copies people already made are kept.`)) return;
    try {
      await templatesApi.remove(template.id);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove the sample.');
    }
  };

  const confirmRename = async (name: string) => {
    const doc = renameTarget;
    if (!doc) return;
    const res = await api(`/diagrams/${doc.id}`, { method: 'PATCH', body: JSON.stringify({ title: name }) });
    if (res.ok) setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, title: name } : d)));
  };

  const duplicate = async (doc: DashboardDocument) => {
    setMenuFor(null);
    // The list carries no `data`; fetch the whole document, then copy it.
    const src = await api(`/diagrams/${doc.id}`);
    if (!src.ok) return;
    const full = (await src.json()) as { data?: { status?: unknown } };
    const created = await createDocument(`${doc.title} (copy)`, doc.type, full.data, doc.category);
    if (!created) return;
    setDocuments((prev) => [{ ...created, thumbnailAt: null, status: normalizeStatus(full.data?.status) }, ...prev]);
  };

  const confirmDelete = async () => {
    const doc = deleteTarget;
    if (!doc) return;
    const res = await api(`/diagrams/${doc.id}`, { method: 'DELETE' });
    if (res.ok) setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  };

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? '';

  const newButton = (
    <button
      onClick={startNew}
      disabled={creating}
      className="flex min-h-11 items-center gap-2 rounded-xl bg-mq-red px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mq-red-hover disabled:opacity-60"
    >
      <Plus size={18} strokeWidth={2.25} />
      {creating ? 'Creating…' : workspace.createLabel}
    </button>
  );

  return (
    <DashboardShell action={newButton}>
      <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
        <WorkspaceSwitch current={workspace.id} />

        <section aria-labelledby="samples-heading" className="mt-8">
          <h1 id="samples-heading" className="text-2xl font-bold tracking-tight text-ink">Sample {workspace.plural}</h1>
          <p className="mt-1 text-sm text-ink-muted">Start from a finished {workspace.noun}: every sample opens as your own editable copy.{isAdmin ? ' You publish samples from a diagram’s menu.' : ''}</p>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workspace.id === 'diagram' && SAMPLES.map((sample) => <SampleCard
              key={sample.id}
              title={sample.heading}
              category={sample.category}
              description={sample.description}
              preview={sample.preview}
              badge="3D"
              pending={activeSample === sample.id}
              error={sampleError?.id === sample.id ? sampleError.message : ''}
              onUse={() => void handleCreateSample(sample)}
            />)}
            {workspace.id === 'whiteboard' && <SampleCard
              key={GEOMETRY_WHITEBOARD_SAMPLE.id}
              title={GEOMETRY_WHITEBOARD_SAMPLE.title}
              category={GEOMETRY_WHITEBOARD_SAMPLE.category}
              description={GEOMETRY_WHITEBOARD_SAMPLE.description}
              thumbnailUrl={GEOMETRY_WHITEBOARD_SAMPLE.imagePath}
              badge="Sample"
              pending={activeSample === GEOMETRY_WHITEBOARD_SAMPLE.id}
              error={sampleError?.id === GEOMETRY_WHITEBOARD_SAMPLE.id ? sampleError.message : ''}
              onUse={() => void handleCreateGeometrySample()}
            />}
            {workspace.id === 'whiteboard' && <SampleCard
              key={DATA_CENTRE_WHITEBOARD_SAMPLE.id}
              title={DATA_CENTRE_WHITEBOARD_SAMPLE.title}
              category={DATA_CENTRE_WHITEBOARD_SAMPLE.category}
              description={DATA_CENTRE_WHITEBOARD_SAMPLE.description}
              thumbnailUrl={DATA_CENTRE_WHITEBOARD_SAMPLE.imagePath}
              badge="AI demo"
              pending={activeSample === DATA_CENTRE_WHITEBOARD_SAMPLE.id}
              error={sampleError?.id === DATA_CENTRE_WHITEBOARD_SAMPLE.id ? sampleError.message : ''}
              onUse={() => void handleCreateWhiteboardSample()}
            />}
            {publishedSamples.map((template) => <SampleCard
              key={template.id}
              title={template.title}
              category={template.category}
              thumbnailUrl={templateThumbnailUrl(template)}
              pending={activeSample === template.id}
              error={sampleError?.id === template.id ? sampleError.message : ''}
              onUse={() => void handleUseTemplate(template)}
              menuOpen={sampleMenuFor === template.id}
              onToggleMenu={isAdmin ? () => setSampleMenuFor(sampleMenuFor === template.id ? null : template.id) : undefined}
              onRemove={isAdmin ? () => void removeSample(template) : undefined}
            />)}
          </div>
          {notice && <p role="status" className="mt-3 text-sm text-ink-muted">{notice}</p>}
        </section>

        <h2 className="mt-10 text-2xl font-bold tracking-tight text-ink">{workspace.title}</h2>
        <p className="mt-1 text-sm text-ink-muted">{workspace.subtitle}</p>

        {loading ? (
          <p className="mt-9 text-center text-ink-muted">Loading...</p>
        ) : documents.length === 0 ? (
          <section className="mt-9 flex min-h-[390px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-line-soft bg-white px-6 py-14 text-center shadow-[0_12px_40px_rgba(44,44,42,0.05)] sm:px-10">
            <div className="flex size-20 items-center justify-center rounded-3xl bg-mq-pink ring-8 ring-mq-pink/45">
              <FilePlus size={34} strokeWidth={1.8} className="text-mq-red" />
            </div>
            <h2 className="mt-7 text-2xl font-semibold tracking-tight text-ink">No {workspace.plural} yet</h2>
            <p className="mt-2 max-w-md text-base leading-7 text-ink-muted">
              {workspace.id === 'diagram'
                ? 'Create your first diagram to get started, or open one of the samples above.'
                : 'Create your first whiteboard to get started. Draw with pencil, brush and shapes, add text, select and move — like Paint.'}
            </p>
            <button
              onClick={startNew}
              disabled={creating}
              className="mt-7 flex min-h-12 items-center gap-2.5 rounded-xl bg-mq-red px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-mq-red-hover disabled:opacity-60"
            >
              <Plus size={18} />
              Create your first {workspace.noun}
            </button>
          </section>
        ) : (
          <>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative sm:max-w-sm sm:flex-1">
                <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${workspace.plural}...`}
                  aria-label={`Search ${workspace.plural}`}
                  className="w-full rounded-lg border border-line bg-white py-2.5 pr-3 pl-10 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
                />
              </div>

              <div className="relative">
                <button
                  onClick={() => setSortMenuOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={sortMenuOpen}
                  className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
                >
                  <ArrowUpDown size={16} className="text-ink-muted" />
                  {currentSortLabel}
                  <ChevronDown size={16} className={`text-ink-muted transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {sortMenuOpen && (
                  <>
                    <button className="fixed inset-0 z-10 cursor-default" onClick={() => setSortMenuOpen(false)} aria-label="Close" tabIndex={-1} />
                    <div role="listbox" className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg">
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          role="option"
                          aria-selected={sortBy === opt.value}
                          onClick={() => {
                            setSortBy(opt.value);
                            setSortMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm ${
                            sortBy === opt.value ? 'bg-mq-pink font-medium text-mq-red' : 'text-ink hover:bg-surface-hover'
                          }`}
                        >
                          {opt.label}
                          {sortBy === opt.value && <Check size={16} className="flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="mt-12 text-center text-ink-muted">No {workspace.plural} match “{search}”.</p>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    workspace={workspace}
                    menuOpen={menuFor === doc.id}
                    onToggleMenu={() => setMenuFor(menuFor === doc.id ? null : doc.id)}
                    onOpen={() => {
                      setMenuFor(null);
                      router.push(`/editor/${doc.id}`);
                    }}
                    onRename={() => {
                      setMenuFor(null);
                      setRenameTarget(doc);
                    }}
                    onDuplicate={() => duplicate(doc)}
                    canPublish={isAdmin && workspace.id === 'diagram'}
                    onPublish={() => void publishSample(doc)}
                    onDelete={() => {
                      setMenuFor(null);
                      setDeleteTarget(doc);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {workspace.id === 'diagram' && (
        <NewDiagramDialog open={newDialogOpen} onClose={() => setNewDialogOpen(false)} onCreate={handleCreateDiagram} suggestions={categorySuggestions} />
      )}
      <DeleteDiagramDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        name={deleteTarget?.title ?? ''}
        noun={workspace.noun}
        onConfirm={confirmDelete}
      />
      <RenameDiagramDialog
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        currentName={renameTarget?.title ?? ''}
        noun={workspace.noun}
        onSave={confirmRename}
      />
    </DashboardShell>
  );
}
