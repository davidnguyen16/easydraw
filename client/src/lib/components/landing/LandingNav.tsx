'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X, LayoutDashboard, LogOut } from 'lucide-react';
import Logo from '@/lib/components/Logo';
import { useAuthStore, accountInitials } from '@/lib/stores/auth.store';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Diagram types', href: '#diagram-types' },
  { label: 'How it works', href: '#how-it-works' },
];

export default function LandingNav() {
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  // authStore.ready flips true after the first GET /auth/me resolves — until
  // then show skeletons instead of flashing guest buttons at a logged-in user.
  const isLoading = !ready;
  const isAuthenticated = !!user;
  const initials = accountInitials(user);

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
  };

  return (
    <header
      className={`sticky top-0 z-40 bg-white/80 backdrop-blur-md transition-shadow ${
        scrolled ? 'border-b border-line-soft shadow-sm' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="EasyDraw home">
          <Logo size="md" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <>
              <div className="hidden h-9 w-20 animate-pulse rounded-lg bg-surface-hover sm:block" />
              <div className="h-9 w-32 animate-pulse rounded-lg bg-surface-hover" />
            </>
          ) : isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                className="flex h-9 items-center rounded-lg bg-mq-red px-3.5 text-sm font-medium text-white transition-colors hover:bg-mq-red-hover"
              >
                Open dashboard
              </Link>
              <div className="relative">
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-full bg-mq-red/10 text-xs font-semibold text-mq-red transition-colors hover:bg-mq-red/20"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((v) => !v)}
                >
                  {initials}
                </button>
                {userMenuOpen && (
                  <>
                    <button
                      className="fixed inset-0 z-10 cursor-default"
                      aria-label="Close menu"
                      tabIndex={-1}
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div
                      className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg"
                      role="menu"
                    >
                      <Link
                        href="/dashboard"
                        role="menuitem"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-hover"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <LayoutDashboard size={16} /> Dashboard
                      </Link>
                      <div className="my-1 h-px bg-line-soft" />
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#b42318] hover:bg-surface-hover"
                        onClick={handleLogout}
                      >
                        <LogOut size={16} /> Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden h-9 items-center rounded-lg px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-hover sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="flex h-9 items-center rounded-lg bg-mq-red px-3.5 text-sm font-medium text-white transition-colors hover:bg-mq-red-hover"
              >
                Get started free
              </Link>
            </>
          )}

          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-lg text-ink hover:bg-surface-hover md:hidden"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line-soft bg-white/95 backdrop-blur-md md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2.5 text-sm text-ink transition-colors hover:bg-surface-hover"
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </a>
            ))}
            {!isLoading && !isAuthenticated && (
              <Link
                href="/login"
                className="rounded-lg px-3 py-2.5 text-sm text-ink transition-colors hover:bg-surface-hover sm:hidden"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
