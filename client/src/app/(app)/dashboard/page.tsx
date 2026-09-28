'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import DashboardShell from '@/lib/dashboard/DashboardShell';
import { WORKSPACES } from '@/lib/dashboard/workspaces';

// The signed-in landing: pick a workspace. Diagrams and whiteboards are
// separate collections with their own dashboards, so the choice comes first.
export default function WorkspaceChooserPage() {
  return (
    <DashboardShell>
      <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-semibold tracking-[0.18em] text-mq-red uppercase">Your workspace</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-[2.75rem] sm:leading-tight">
          What would you like to work on?
        </h1>
        <p className="mt-3 text-lg text-ink-muted">
          Choose a workspace. Your diagrams and whiteboards stay organized separately.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {WORKSPACES.map((workspace) => {
            const Icon = workspace.icon;
            return (
              <Link
                key={workspace.id}
                href={workspace.path}
                className="group flex flex-col rounded-3xl border border-line-soft bg-white p-8 shadow-[0_12px_40px_rgba(44,44,42,0.05)] transition hover:border-mq-red hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mq-red sm:p-10"
              >
                <span className="flex size-20 items-center justify-center rounded-3xl bg-mq-pink">
                  <Icon size={34} strokeWidth={1.7} className="text-mq-red" aria-hidden="true" />
                </span>
                <h2 className="mt-9 text-3xl font-semibold tracking-tight text-ink">{workspace.label}</h2>
                <p className="mt-3 text-lg text-ink-muted">{workspace.blurb}</p>
                <p className="mt-6 text-sm text-ink-muted">{workspace.tagline}</p>
                <span className="mt-8 flex items-center justify-between border-t border-line-soft pt-6 text-base font-semibold text-mq-red">
                  Open {workspace.label} dashboard
                  <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </DashboardShell>
  );
}
