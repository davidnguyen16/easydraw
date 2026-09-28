'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Logo from '@/lib/components/Logo';
import UserMenu from './UserMenu';

/**
 * Frame shared by the workspace chooser and both document dashboards: the
 * white header (logo, an optional primary action, the user menu) over the
 * warm panel background.
 */
export default function DashboardShell({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-panel">
      <header className="border-b border-line-soft bg-white">
        <div className="flex w-full items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/dashboard" aria-label="All workspaces" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mq-red">
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            {action}
            <UserMenu />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
