'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useAuthStore, accountInitials } from '@/lib/stores/auth.store';

/** Avatar + name dropdown shared by every dashboard page. */
export default function UserMenu() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [open, setOpen] = useState(false);

  const displayName = user?.name ?? user?.email ?? 'User';

  const openSettings = () => {
    setOpen(false);
    router.push('/settings');
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.push('/login');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-h-11 items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 transition-colors hover:bg-surface-hover"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-mq-maroon text-xs font-semibold text-white">
          {accountInitials(user)}
        </span>
        <span className="hidden max-w-40 truncate text-sm font-medium text-ink sm:block">{displayName}</span>
        <ChevronDown size={16} className="text-ink-muted" />
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            tabIndex={-1}
          />
          <div role="menu" className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-white shadow-lg">
            <div className="border-b border-line px-3 py-2.5">
              <p className="truncate text-sm font-medium text-ink">{displayName}</p>
              <p className="truncate text-xs text-ink-muted">{user?.email}</p>
            </div>
            <button
              role="menuitem"
              onClick={openSettings}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-hover"
            >
              <Settings size={16} />
              Settings
            </button>
            <button
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-hover"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
