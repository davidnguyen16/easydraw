import { MousePointerClick, Spline, Layers, Palette, Cloud, Download } from 'lucide-react';

const features = [
  {
    icon: MousePointerClick,
    title: 'Drag & drop shape library',
    desc: 'A rich shape library — just drag shapes onto the canvas and start building.',
  },
  {
    icon: Spline,
    title: 'Smart connectors and ERD cardinalities',
    desc: 'Orthogonal routing, labels, and one-to-many cardinalities on every connection.',
  },
  {
    icon: Layers,
    title: 'Multi-page canvas',
    desc: 'Organize complex projects across multiple pages within a single diagram.',
  },
  {
    icon: Palette,
    title: 'Node and connection styling',
    desc: 'Customize fills, borders, typography, and effects for every node and edge.',
  },
  {
    icon: Cloud,
    title: 'Auto-save and document status',
    desc: 'Changes are saved automatically while you work, with a clear save indicator.',
  },
  {
    icon: Download,
    title: 'Export and backup',
    desc: 'Export diagrams as PNG, JPEG, or PDF — or back them up as .easydraw files.',
  },
];

export default function Features() {
  return (
    // half-white wash over the cream page ground
    <section id="features" className="border-t border-line-soft bg-white/50">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-ink sm:text-4xl">Everything You Need To Diagram</h2>
          <p className="mx-auto mt-4 max-w-2xl text-ink-muted">
            A focused toolset for technical diagrams — no clutter, no learning curve.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-xl border border-line-soft bg-white p-6 transition-colors
                  hover:border-mq-red/40"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-mq-red/10 text-mq-red">
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
