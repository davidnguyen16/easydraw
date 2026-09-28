import Link from 'next/link';
import Logo from '@/lib/components/Logo';
import styles from './LandingNavigation.module.css';

export default function LandingFooter({ variant = 'legacy' }: { variant?: 'home' | 'legacy' }) {
  const year = new Date().getFullYear();

  if (variant === 'home') return <footer className={styles.footer}>
    <div className={styles.footerInner}>
      <div className={styles.footerBrand}>
        <Link href="/" aria-label="EasyDraw home" className={styles.logo}><Logo size="sm" /></Link>
        <p>A little sketch. A bigger perspective.</p>
      </div>
      <div className={styles.footerMeta}>
        <nav aria-label="Legal information" className={styles.footerLinks}>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <p>© {year} EasyDraw</p>
      </div>
    </div>
  </footer>;

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
