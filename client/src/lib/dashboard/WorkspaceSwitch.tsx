'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { WORKSPACES, type WorkspaceId } from './workspaces';

/**
 * Sits above a dashboard's title: a way back to the chooser and a segmented
 * toggle between the two workspaces. Links, not buttons, so each workspace
 * is a real URL the browser can bookmark and go back to.
 */
export default function WorkspaceSwitch({ current }: { current: WorkspaceId }) {
  return (
    <nav aria-label="Workspace" className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <Link
        href="/dashboard"
        className="inline-flex min-h-9 items-center gap-2 rounded-md text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        All workspaces
      </Link>
      <div className="inline-flex items-center gap-1 rounded-xl border border-line-soft bg-white p-1 shadow-sm">
        {WORKSPACES.map((workspace) => {
          const active = workspace.id === current;
          const Icon = workspace.icon;
          return (
            <Link
              key={workspace.id}
              href={workspace.path}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors ${
                active ? 'bg-mq-pink text-mq-red' : 'text-ink-soft hover:bg-surface-hover'
              }`}
            >
              <Icon size={16} aria-hidden="true" />
              {workspace.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
