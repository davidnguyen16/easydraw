type Size = 'sm' | 'md' | 'lg';

// Port of Logo.svelte — icon rendered at a fixed pixel box per size; wordmark
// scales with it.
export default function Logo({
  size = 'md',
  showText = true,
  className = '',
}: {
  size?: Size;
  showText?: boolean;
  className?: string;
}) {
  const icon = size === 'lg' ? 48 : size === 'sm' ? 24 : 32;
  const text = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width={icon} height={icon} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="4" y="4" width="40" height="40" rx="8" className="fill-mq-red" />
        <rect x="12" y="12" width="12" height="8" rx="2" className="fill-white/90" />
        <rect x="28" y="28" width="12" height="8" rx="2" className="fill-white/90" />
        <path d="M24 16 L28 16 L28 32" className="stroke-white/70" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="16" r="1.5" className="fill-white/70" />
        <circle cx="28" cy="32" r="1.5" className="fill-white/70" />
      </svg>
      {showText && (
        <span className={`${text} font-semibold tracking-tight`}>
          <span className="text-mq-red">Easy</span>
          <span className="text-ink">Draw</span>
        </span>
      )}
    </div>
  );
}
