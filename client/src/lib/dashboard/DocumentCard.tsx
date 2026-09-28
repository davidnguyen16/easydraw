'use client';

import Link from 'next/link';
import { Copy, FolderOpen, MoreHorizontal, Pencil, Trash2, Upload } from 'lucide-react';
import type { DiagramStatus } from '@/lib/stores/editor-meta.store';
import { diagramThumbnailUrl } from './templates';
import type { Workspace } from './workspaces';

export type DashboardDocument = {
  id: string;
  title: string;
  /** Editor kind: 'diagram' | 'whiteboard'. */
  type: string;
  /** The label the owner gave it ("ERD", "Network"…), if any. */
  category: string | null;
  updatedAt: string;
  /** When the editor last sent a preview; null until the first save in 2D. */
  thumbnailAt: string | null;
  status: DiagramStatus;
};

const STATUS_META: Record<DiagramStatus, { label: string; badgeClass: string; dotClass: string }> = {
  draft: { label: 'Draft', badgeClass: 'bg-orange-50 text-orange-700', dotClass: 'bg-orange-500' },
  complete: { label: 'Complete', badgeClass: 'bg-green-50 text-green-700', dotClass: 'bg-green-500' },
  archived: { label: 'Archived', badgeClass: 'bg-gray-100 text-gray-600', dotClass: 'bg-gray-400' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DocumentCard({
  doc,
  workspace,
  menuOpen,
  canPublish = false,
  onToggleMenu,
  onOpen,
  onRename,
  onDuplicate,
  onPublish,
  onDelete,
}: {
  doc: DashboardDocument;
  workspace: Workspace;
  menuOpen: boolean;
  /** Admins can publish a diagram as a sample for every account. */
  canPublish?: boolean;
  onToggleMenu: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onPublish?: () => void;
  onDelete: () => void;
}) {
  // Status is a diagram-editor concept; whiteboards have no such state yet.
  const status = workspace.id === 'diagram' ? STATUS_META[doc.status] : null;
  const thumbnail = diagramThumbnailUrl(doc);
  const Icon = workspace.icon;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line-soft bg-white shadow-sm transition hover:border-mq-red hover:shadow-md">
      <Link href={`/editor/${doc.id}`} className="block">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-panel/50">
          {thumbnail
            /* The canvas as last saved, from the private API: a CORS request with the cookie, so only this origin may embed it. */
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={thumbnail} alt="" loading="lazy" draggable={false} crossOrigin="use-credentials" className="size-full object-contain p-2 transition-transform group-hover:scale-[1.02]" />
            : <div className="flex flex-col items-center gap-2">
              <Icon size={40} strokeWidth={1.4} className="text-mq-red/70 transition-transform group-hover:scale-105" />
              <span className="text-xs font-semibold tracking-wide text-mq-red/70">{workspace.label.toUpperCase()}</span>
            </div>}
          {doc.category && <span className="absolute bottom-2 left-2 rounded-full border border-line-soft bg-white/90 px-2 py-0.5 text-[11px] font-medium text-mq-maroon">{doc.category}</span>}
        </div>
        <div className="border-t border-line-soft px-4 py-3">
          <p className="truncate text-sm font-medium text-ink">{doc.title}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-ink-muted">Edited {formatDate(doc.updatedAt)}</p>
            {status && (
              <span className={`${status.badgeClass} inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium`}>
                <span className={`${status.dotClass} size-1.5 rounded-full`} />
                {status.label}
              </span>
            )}
          </div>
        </div>
      </Link>

      <button
        onClick={onToggleMenu}
        aria-label={`${workspace.label} actions`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={`absolute top-2 right-2 flex size-8 items-center justify-center rounded-lg border border-line bg-white text-ink-muted shadow-sm transition-opacity hover:text-ink ${
          menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
        }`}
      >
        <MoreHorizontal size={18} />
      </button>

      {menuOpen && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" onClick={onToggleMenu} aria-label="Close" tabIndex={-1} />
          <div role="menu" className="absolute top-11 right-2 z-20 w-44 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg">
            <MenuItem icon={<FolderOpen size={16} />} label="Open" onClick={onOpen} />
            <MenuItem icon={<Pencil size={16} />} label="Rename" onClick={onRename} />
            <MenuItem icon={<Copy size={16} />} label="Duplicate" onClick={onDuplicate} />
            {canPublish && onPublish && <MenuItem icon={<Upload size={16} />} label="Publish as sample" onClick={onPublish} />}
            <button
              role="menuitem"
              onClick={onDelete}
              className="mt-1 flex w-full items-center gap-2.5 border-t border-line px-3 py-2 text-left text-sm text-mq-red hover:bg-mq-pink"
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface-hover">
      {icon} {label}
    </button>
  );
}
