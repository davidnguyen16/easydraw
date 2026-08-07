import { UserPlus, PenTool, Share2 } from 'lucide-react';

const steps = [
  {
    icon: UserPlus,
    step: '01',
    title: 'Create a free account',
    desc: 'Sign up in seconds — no payment details required.',
  },
  {
    icon: PenTool,
    step: '02',
    title: 'Draw your diagram',
    desc: 'Drag shapes onto the canvas, connect them, and style everything to fit.',
  },
  {
    icon: Share2,
    step: '03',
    title: 'Export and share',
    desc: 'Download as PNG, JPEG, or PDF, or keep a .easydraw backup.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-line-soft">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-ink sm:text-4xl">How It Works</h2>
          <p className="mx-auto mt-4 max-w-2xl text-ink-muted">
            From blank canvas to shareable diagram in three steps.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="relative rounded-xl border border-line-soft bg-white p-6">
                <span className="absolute top-5 right-6 text-3xl font-bold text-mq-red/10">
                  {s.step}
                </span>
                <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-mq-red/10 text-mq-red">
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
