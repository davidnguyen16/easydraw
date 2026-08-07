import type { ReactNode } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, Mail } from 'lucide-react';
import LandingFooter from '@/lib/components/landing/LandingFooter';
import Logo from '@/lib/components/Logo';

type SectionLink = { id: string; title: string };

// Shared chrome for /terms and /privacy — sticky header, hero, table of
// contents, and the article body. The page sets <title>/description via
// exported metadata (the Svelte <svelte:head> equivalent).
export default function LegalLayout({
  title,
  description,
  lastUpdated,
  sections,
  children,
}: {
  title: string;
  description: string;
  lastUpdated: string;
  sections: SectionLink[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f3]">
      <header className="sticky top-0 z-40 border-b border-line-soft bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="EasyDraw home">
            <Logo size="md" />
          </Link>

          <nav className="flex items-center gap-2" aria-label="Legal page navigation">
            <Link
              href="/"
              className="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-hover sm:flex"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Home
            </Link>
            <Link
              href="/dashboard"
              className="flex h-9 items-center rounded-lg bg-mq-red px-3.5 text-sm font-medium text-white transition-colors hover:bg-mq-red-hover"
            >
              Open EasyDraw
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-line-soft bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="mb-5 inline-flex items-center rounded-full border border-mq-red/15 bg-mq-pink px-3 py-1 text-xs font-semibold tracking-wider text-mq-red uppercase">
              EasyDraw legal
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              {title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-ink-muted sm:text-lg">
              {description}
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
              <CalendarDays size={16} aria-hidden="true" />
              <span>Last updated: {lastUpdated}</span>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
          <details className="rounded-xl border border-line bg-white p-4 shadow-sm lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-ink">On this page</summary>
            <nav className="mt-3 grid gap-1" aria-label="Table of contents">
              {sections.map((section, index) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex gap-3 rounded-lg px-2 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
                >
                  <span className="font-mono text-xs text-mq-red">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{section.title}</span>
                </a>
              ))}
            </nav>
          </details>

          <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto lg:block">
            <p className="mb-3 px-3 text-xs font-semibold tracking-wider text-ink-muted uppercase">
              On this page
            </p>
            <nav className="grid gap-0.5" aria-label="Table of contents">
              {sections.map((section, index) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="group flex gap-3 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-white hover:text-ink"
                >
                  <span className="font-mono text-xs text-mq-red/70 group-hover:text-mq-red">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{section.title}</span>
                </a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="px-5 sm:px-8 lg:px-10">{children}</div>

            <div className="border-t border-line-soft bg-panel px-5 py-7 sm:px-8 lg:px-10">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-base font-semibold text-ink">Questions about this page?</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    We are happy to clarify how EasyDraw works.
                  </p>
                </div>
                <a
                  href="mailto:support@easydraw.net"
                  className="inline-flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink transition-colors hover:border-mq-red/30 hover:text-mq-red"
                >
                  <Mail size={16} aria-hidden="true" />
                  support@easydraw.net
                </a>
              </div>
            </div>
          </article>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
