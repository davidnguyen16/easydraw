'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  ChevronDown,
  Settings,
  LogOut,
  FilePlus,
  FileText,
  Search,
  ArrowUpDown,
  Check,
  MoreHorizontal,
  FolderOpen,
  Pencil,
  Copy,
  Trash2,
} from 'lucide-react';
import Logo from '@/lib/components/Logo';
import { useAuthStore, accountInitials } from '@/lib/stores/auth.store';
import { API_URL } from '@/lib/api';
import NewDiagramDialog from '@/lib/components/NewDiagramDialog';
import DeleteDiagramDialog from '@/lib/components/DeleteDiagramDialog';
import RenameDiagramDialog from '@/lib/components/RenameDiagramDialog';
import { DIAGRAM_TYPE_MAP, type DiagramType } from '@/lib/diagram-types';
import type { DiagramStatus } from '@/lib/stores/editor-meta.store';

type Diagram = {
  id: string;
  title: string;
  type: string;
  updatedAt: string;
  status?: DiagramStatus;
};

const STATUS_META: Record<DiagramStatus, { label: string; badgeClass: string; dotClass: string }> = {
  draft: { label: 'Draft', badgeClass: 'bg-orange-50 text-orange-700', dotClass: 'bg-orange-500' },
  complete: { label: 'Complete', badgeClass: 'bg-green-50 text-green-700', dotClass: 'bg-green-500' },
  archived: { label: 'Archived', badgeClass: 'bg-gray-100 text-gray-600', dotClass: 'bg-gray-400' },
};

type SortKey = 'recent' | 'oldest' | 'name-asc' | 'name-desc';

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'oldest', label: 'Least recently updated' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function typeMeta(type: string) {
  return DIAGRAM_TYPE_MAP[type as DiagramType] ?? DIAGRAM_TYPE_MAP.erd;
}

function normalizeStatus(status: unknown): DiagramStatus {
  return status === 'complete' || status === 'archived' ? status : 'draft';
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Diagram | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Diagram | null>(null);

  const currentSortLabel = sortOptions.find((o) => o.value === sortBy)?.label ?? '';
  const displayName = user?.name ?? user?.email ?? 'User';
  const initials = accountInitials(user);

  const filtered = diagrams
    .filter((d) => d.title.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'name-asc':
          return a.title.localeCompare(b.title);
        case 'name-desc':
          return b.title.localeCompare(a.title);
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

  const handleCreateDiagram = async ({ name, type }: { name: string; type: string }) => {
    const res = await fetch(`${API_URL}/diagrams`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: name, type }),
    });
    if (!res.ok) return;
    const created = await res.json();
    router.push(`/editor/${created.id}`);
  };

  const openDiagram = (d: Diagram) => {
    setMenuFor(null);
    router.push(`/editor/${d.id}`);
  };

  const askRename = (d: Diagram) => {
    setMenuFor(null);
    setRenameTarget(d);
    setRenameOpen(true);
  };

  const confirmRename = async (name: string) => {
    const d = renameTarget;
    if (!d) return;
    const res = await fetch(`${API_URL}/diagrams/${d.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: name }),
    });
    if (res.ok) setDiagrams((prev) => prev.map((x) => (x.id === d.id ? { ...x, title: name } : x)));
  };

  const duplicateDiagram = async (d: Diagram) => {
    setMenuFor(null);
    // The list doesn't carry `data`, so fetch the full diagram first, then copy it.
    const src = await fetch(`${API_URL}/diagrams/${d.id}`, { credentials: 'include' });
    if (!src.ok) return;
    const full = await src.json();
    const res = await fetch(`${API_URL}/diagrams`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `${d.title} (copy)`, type: d.type, data: full.data }),
    });
    if (!res.ok) return;
    const created = await res.json();
    setDiagrams((prev) => [
      {
        id: created.id,
        title: created.title,
        type: created.type,
        updatedAt: created.updatedAt,
        status: normalizeStatus(full.data?.status),
      },
      ...prev,
    ]);
  };

  const askDelete = (d: Diagram) => {
    setMenuFor(null);
    setDeleteTarget(d);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    const d = deleteTarget;
    if (!d) return;
    const res = await fetch(`${API_URL}/diagrams/${d.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) setDiagrams((prev) => prev.filter((x) => x.id !== d.id));
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.push('/login');
  };

  const openSettings = () => {
    setMenuOpen(false);
    router.push('/settings');
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/diagrams`, { credentials: 'include' });
        if (res.ok) {
          const result = (await res.json()) as Diagram[];
          setDiagrams(result.map((diagram) => ({ ...diagram, status: normalizeStatus(diagram.status) })));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-panel">
      {/* Header */}
      <header className="border-b border-line-soft bg-white">
        <div className="flex w-full items-center justify-between px-5 py-4 sm:px-8">
          <Logo size="md" />

          <div className="flex items-center gap-4">
            <button
              onClick={() => setDialogOpen(true)}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-mq-red px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-mq-red-hover"
            >
              <Plus size={18} strokeWidth={2.25} />
              New Diagram
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex min-h-11 items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 transition-colors hover:bg-surface-hover"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-mq-maroon text-xs font-semibold text-white">
                  {initials}
                </span>
                <span className="hidden max-w-40 truncate text-sm font-medium text-ink sm:block">
                  {displayName}
                </span>
                <ChevronDown size={16} className="text-ink-muted" />
              </button>

              {menuOpen && (
                <>
                  <button
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Close menu"
                    tabIndex={-1}
                  />
                  <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-white shadow-lg">
                    <div className="border-b border-line px-3 py-2.5">
                      <p className="truncate text-sm font-medium text-ink">{displayName}</p>
                      <p className="truncate text-xs text-ink-muted">{user?.email}</p>
                    </div>
                    <button
                      onClick={openSettings}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-hover"
                    >
                      <Settings size={16} />
                      Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-hover"
                    >
                      <LogOut size={16} />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-bold tracking-tight text-ink">My Diagrams</h1>
        <p className="mt-1.5 text-base text-ink-muted">Create and manage your technical diagrams</p>

        {loading ? (
          <p className="mt-9 text-center text-ink-muted">Loading...</p>
        ) : diagrams.length === 0 ? (
          <section className="mt-9 flex min-h-[390px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-line-soft bg-white px-6 py-14 text-center shadow-[0_12px_40px_rgba(44,44,42,0.05)] sm:px-10">
            <div className="flex size-20 items-center justify-center rounded-3xl bg-mq-pink ring-8 ring-mq-pink/45">
              <FilePlus size={34} strokeWidth={1.8} className="text-mq-red" />
            </div>
            <h2 className="mt-7 text-2xl font-semibold tracking-tight text-ink">No diagrams yet</h2>
            <p className="mt-2 max-w-md text-base leading-7 text-ink-muted">
              Create your first diagram to get started. Choose from ERD, UML, flowcharts, and more.
            </p>
            <button
              onClick={() => setDialogOpen(true)}
              className="mt-7 flex min-h-12 items-center gap-2.5 rounded-xl bg-mq-red px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-mq-red-hover"
            >
              <FileText size={18} />
              Create your first diagram
            </button>
          </section>
        ) : (
          <>
            {/* Search + Sort */}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative sm:max-w-sm sm:flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search diagrams..."
                  className="w-full rounded-lg border border-line bg-white py-2.5 pr-3 pl-10 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
                />
              </div>

              <div className="relative">
                <button
                  onClick={() => setSortMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
                >
                  <ArrowUpDown size={16} className="text-ink-muted" />
                  {currentSortLabel}
                  <ChevronDown
                    size={16}
                    className={`text-ink-muted transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {sortMenuOpen && (
                  <>
                    <button
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setSortMenuOpen(false)}
                      aria-label="Close"
                      tabIndex={-1}
                    />
                    <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg">
                      {sortOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setSortBy(opt.value);
                            setSortMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm ${
                            sortBy === opt.value
                              ? 'bg-mq-pink font-medium text-mq-red'
                              : 'text-ink hover:bg-surface-hover'
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

            {/* Grid */}
            {filtered.length === 0 ? (
              <p className="mt-12 text-center text-ink-muted">No diagrams match “{search}”.</p>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((d) => {
                  const meta = typeMeta(d.type);
                  const status = STATUS_META[normalizeStatus(d.status)];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={d.id}
                      className="group relative overflow-hidden rounded-2xl border border-line-soft bg-white shadow-sm transition hover:border-mq-red hover:shadow-md"
                    >
                      <Link href={`/editor/${d.id}`} className="block">
                        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-panel/50">
                          <Icon
                            size={40}
                            strokeWidth={1.4}
                            className="text-mq-red/70 transition-transform group-hover:scale-105"
                          />
                          <span className="text-xs font-semibold tracking-wide text-mq-red/70">
                            {meta.label}
                          </span>
                        </div>
                        <div className="border-t border-line-soft px-4 py-3">
                          <p className="truncate text-sm font-medium text-ink">{d.title}</p>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-xs text-ink-muted">
                              Edited {formatDate(d.updatedAt)}
                            </p>
                            <span
                              className={`${status.badgeClass} inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium`}
                            >
                              <span className={`${status.dotClass} size-1.5 rounded-full`} />
                              {status.label}
                            </span>
                          </div>
                        </div>
                      </Link>

                      {/* ⋯ actions button */}
                      <button
                        onClick={() => setMenuFor(menuFor === d.id ? null : d.id)}
                        aria-label="Diagram actions"
                        className={`absolute top-2 right-2 flex size-8 items-center justify-center rounded-lg border border-line bg-white text-ink-muted shadow-sm transition-opacity hover:text-ink ${
                          menuFor === d.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {menuFor === d.id && (
                        <>
                          <button
                            className="fixed inset-0 z-10 cursor-default"
                            onClick={() => setMenuFor(null)}
                            aria-label="Close"
                            tabIndex={-1}
                          />
                          <div className="absolute top-11 right-2 z-20 w-40 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg">
                            <button
                              onClick={() => openDiagram(d)}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
                            >
                              <FolderOpen size={16} /> Open
                            </button>
                            <button
                              onClick={() => askRename(d)}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
                            >
                              <Pencil size={16} /> Rename
                            </button>
                            <button
                              onClick={() => duplicateDiagram(d)}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover"
                            >
                              <Copy size={16} /> Duplicate
                            </button>
                            <button
                              onClick={() => askDelete(d)}
                              className="mt-1 flex w-full items-center gap-2.5 border-t border-line px-3 py-2 text-left text-sm text-mq-red hover:bg-mq-pink"
                            >
                              <Trash2 size={16} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <NewDiagramDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreateDiagram}
      />

      <DeleteDiagramDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        name={deleteTarget?.title ?? ''}
        onConfirm={confirmDelete}
      />

      <RenameDiagramDialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        currentName={renameTarget?.title ?? ''}
        onSave={confirmRename}
      />
    </div>
  );
}
