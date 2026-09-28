'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ArrowUpRight, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import Logo from '@/lib/components/Logo';
import { accountInitials, useAuthStore } from '@/lib/stores/auth.store';
import styles from './LandingNavigation.module.css';

const navLinks = [
  { label: 'Workspace', href: '#workspace' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Explore 3D', href: '#playground' },
];

export default function LandingNav() {
  const ready = useAuthStore((state) => state.ready);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [open, setOpen] = useState<'mobile' | 'account' | null>(null);
  const header = useRef<HTMLElement>(null);
  const account = useRef<HTMLDivElement>(null);
  const accountMenu = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  const firstAccountFocus = useRef<'first' | 'last'>('first');

  useEffect(() => {
    if (!open) return;
    if (open === 'account') {
      const items = accountMenu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
      items?.[firstAccountFocus.current === 'last' ? items.length - 1 : 0]?.focus();
    }
    const closeOutside = (event: Event) => {
      const boundary = open === 'account' ? account.current : header.current;
      if (event.target instanceof Node && !boundary?.contains(event.target)) setOpen(null);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(null);
      (open === 'account' ? accountButton : mobileButton).current?.focus();
    };
    const desktop = window.matchMedia('(min-width: 980px)');
    const resize = () => { if (desktop.matches && open === 'mobile') setOpen(null); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', escape);
    desktop.addEventListener('change', resize);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', escape);
      desktop.removeEventListener('change', resize);
    };
  }, [open]);

  function accountKeys(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(accountMenu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    if (event.key === 'Tab') {
      // Restore the trigger first; native Tab then proceeds out of the menu.
      setOpen(null);
      accountButton.current?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    items[next]?.focus();
  }

  async function handleLogout() {
    setOpen(null);
    try { await logout(); } catch { /* The shared store clears local auth in its finally block. */ }
  }

  return <header ref={header} className={styles.header}>
    <div className={styles.navInner}>
      <Link href="/" aria-label="EasyDraw home" className={styles.logo} onClick={() => setOpen(null)}><Logo size="md" /></Link>
      <nav aria-label="Main navigation" className={styles.desktopLinks}>
        {navLinks.map((link) => <a key={link.href} href={link.href} className={styles.navLink}>{link.label}</a>)}
      </nav>
      <div className={styles.actions} aria-busy={!ready}>
        {!ready ? <div className={styles.skeleton} role="status" aria-label="Checking your account" /> : user ? <>
          <Link href="/dashboard" className={styles.primaryButton + ' ' + styles.workspaceButton}>Open workspace <ArrowUpRight size={15} aria-hidden="true" /></Link>
          <div ref={account} className={styles.account}>
            <button ref={accountButton} type="button" className={styles.accountButton} aria-label="Account menu"
              aria-haspopup="menu" aria-controls="landing-account-menu" aria-expanded={open === 'account'}
              onClick={() => { firstAccountFocus.current = 'first'; setOpen(open === 'account' ? null : 'account'); }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  firstAccountFocus.current = event.key === 'ArrowUp' ? 'last' : 'first';
                  setOpen('account');
                }
              }}>{accountInitials(user)}</button>
            {open === 'account' && <div ref={accountMenu} id="landing-account-menu" role="menu" aria-label="Your account" className={styles.accountMenu} onKeyDown={accountKeys}>
              <p className={styles.accountName}>{user.name || user.email}</p>
              <Link href="/dashboard" role="menuitem" className={styles.menuItem} onClick={() => setOpen(null)}><LayoutDashboard size={16} aria-hidden="true" /> Dashboard</Link>
              <button type="button" role="menuitem" className={styles.menuItem + ' ' + styles.logout} onClick={() => void handleLogout()}><LogOut size={16} aria-hidden="true" /> Log out</button>
            </div>}
          </div>
        </> : <>
          <Link href="/login" className={styles.signIn}>Sign in</Link>
          <Link href="/register" className={styles.primaryButton}>Start creating <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </>}
        <button ref={mobileButton} type="button" className={styles.mobileToggle}
          aria-label={open === 'mobile' ? 'Close navigation' : 'Open navigation'} aria-expanded={open === 'mobile'} aria-controls="landing-mobile-navigation"
          onClick={() => setOpen(open === 'mobile' ? null : 'mobile')}>
          {open === 'mobile' ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>
    </div>
    <nav id="landing-mobile-navigation" aria-label="Mobile navigation" className={styles.mobileLinks} hidden={open !== 'mobile'}>
      {navLinks.map((link) => <a key={link.href} href={link.href} onClick={() => setOpen(null)}>{link.label}</a>)}
      {ready && !user && <Link href="/login" onClick={() => setOpen(null)}>Sign in</Link>}
      {ready && user && <Link href="/dashboard" onClick={() => setOpen(null)}>Open workspace <ArrowUpRight size={15} aria-hidden="true" /></Link>}
    </nav>
  </header>;
}
