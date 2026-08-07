import Link from 'next/link';
import Logo from '@/lib/components/Logo';

export default function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line-soft bg-[#faf8f3]">
      <div
        className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10
          sm:flex-row sm:px-6"
      >
        <Logo size="sm" />
        <p className="text-xs text-ink-muted">© {year} EasyDraw. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="text-xs text-ink-muted transition-colors hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="text-xs text-ink-muted transition-colors hover:text-ink">
            Privacy
          </Link>
          <Link href="/login" className="text-xs text-ink-muted transition-colors hover:text-ink">
            Sign in
          </Link>
          <Link href="/register" className="text-xs text-ink-muted transition-colors hover:text-ink">
            Get started
          </Link>
        </div>
      </div>
    </footer>
  );
}
