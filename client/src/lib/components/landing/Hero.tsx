'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth.store';
import HeroPreview from './HeroPreview';

export default function Hero() {
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const isLoading = !ready;
  const isAuthenticated = !!user;

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-8 text-center sm:px-6 sm:pt-14 sm:pb-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-mq-red/10 px-3 py-1 text-xs font-medium text-mq-red">
          <span className="size-1.5 rounded-full bg-mq-red" />
          Free to use
        </div>
        {/* 900px cap keeps the headline on ONE line at text-5xl on desktop. */}
        <h1 className="mx-auto max-w-[900px] text-4xl leading-tight font-bold tracking-tight text-ink sm:text-5xl">
          Design Technical Diagrams With Ease
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-ink-muted">
          ERDs and Flowcharts in a clean, intuitive canvas with flexible shapes for UML and
          data-flow diagrams.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {isLoading ? (
            <div className="h-12 w-48 animate-pulse rounded-lg bg-surface-hover" />
          ) : isAuthenticated ? (
            <Link
              href="/dashboard"
              className="flex h-12 items-center gap-2 rounded-lg bg-mq-red px-6 font-medium text-white transition-colors hover:bg-mq-red-hover"
            >
              Open dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="flex h-12 items-center gap-2 rounded-lg bg-mq-red px-6 font-medium text-white transition-colors hover:bg-mq-red-hover"
              >
                Start drawing free <ArrowRight size={16} />
              </Link>
              <a
                href="#how-it-works"
                className="flex h-12 items-center rounded-lg border border-line px-6 font-medium text-ink transition-colors hover:bg-surface-hover"
              >
                See how it works
              </a>
            </>
          )}
        </div>
      </div>
      <HeroPreview />
    </section>
  );
}
