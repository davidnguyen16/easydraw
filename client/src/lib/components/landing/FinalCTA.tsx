'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth.store';

export default function FinalCTA() {
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const isLoading = !ready;
  const isAuthenticated = !!user;

  return (
    <section className="border-t border-line-soft bg-mq-red">
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready To Start Diagramming?</h2>
        <p className="mx-auto mt-4 max-w-xl text-white/80">
          EasyDraw is free to use — no payment details, no trial limits.
        </p>
        <div className="mt-8 flex justify-center">
          {isLoading ? (
            <div className="h-12 w-48 animate-pulse rounded-lg bg-white/20" />
          ) : (
            <Link
              href={isAuthenticated ? '/dashboard' : '/register'}
              className="flex h-12 items-center gap-2 rounded-lg bg-white px-6 font-medium text-mq-red transition-colors hover:bg-white/90"
            >
              {isAuthenticated ? 'Open dashboard' : 'Start drawing free'}
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
