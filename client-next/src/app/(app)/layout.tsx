'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';

// Route guard for authenticated pages (dashboard, settings, editor). Port of
// (app)/+layout.svelte — waits for the first /auth/me (`ready`), then bounces
// guests to /login; shows a Loading placeholder until the check resolves.
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = !!user;

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace('/login');
  }, [ready, isAuthenticated, router]);

  if (ready && isAuthenticated) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-panel text-ink-muted">
      Loading...
    </div>
  );
}
