// Phase 0 scaffold check — verifies Tailwind v4 + the ported @theme tokens +
// the editor fonts all render. Replaced by the real landing page in Phase 6.

const SWATCHES: { name: string; className: string }[] = [
  { name: "mq-maroon", className: "bg-mq-maroon" },
  { name: "mq-red", className: "bg-mq-red" },
  { name: "mq-pink", className: "bg-mq-pink" },
  { name: "ink", className: "bg-ink" },
  { name: "panel", className: "bg-panel" },
  { name: "surface-hover", className: "bg-surface-hover" },
  { name: "line", className: "bg-line" },
];

const FONTS = ["Inter", "Gentium Basic", "Orbitron", "Komika Hand", "Liberation Mono"];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-panel p-10">
      <div className="text-center">
        <h1 className="text-4xl font-bold">
          <span className="text-mq-red">Easy</span>
          <span className="text-ink">Draw</span>
        </h1>
        <p className="mt-2 text-ink-muted">Next.js migration — Phase 0 scaffold ✅</p>
      </div>

      <section className="flex flex-col items-center gap-2">
        <span className="text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">
          THEME TOKENS
        </span>
        <div className="flex gap-2">
          {SWATCHES.map((s) => (
            <div key={s.name} className="flex flex-col items-center gap-1">
              <span
                className={`${s.className} h-10 w-10 rounded-md border border-line`}
                title={s.name}
              />
              <span className="text-[0.6rem] text-ink-muted">{s.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center gap-1">
        <span className="text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">FONTS</span>
        {FONTS.map((f) => (
          <span key={f} style={{ fontFamily: f }} className="text-lg text-ink-soft">
            {f} — The quick brown fox
          </span>
        ))}
      </section>
    </main>
  );
}
