import type { ReactNode } from 'react';

// Numbered legal section. The `.legal-copy` class styles the prose children
// (p/ul/ol/a/strong/h3) — those rules live in globals.css (ported from this
// component's scoped :global block).
export default function LegalSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-line-soft py-8 last:border-b-0 sm:py-10">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 flex size-7 flex-shrink-0 items-center justify-center rounded-lg bg-mq-pink font-mono text-xs font-semibold text-mq-red">
          {String(number).padStart(2, '0')}
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h2>
      </div>

      <div className="legal-copy pl-0 text-[15px] leading-7 text-ink-soft sm:pl-10">{children}</div>
    </section>
  );
}
