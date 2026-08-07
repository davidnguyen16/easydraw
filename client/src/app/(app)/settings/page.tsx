'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, LogOut, ShieldAlert, Trash2, User } from 'lucide-react';
import Logo from '@/lib/components/Logo';
import DeleteAccountDialog from '@/lib/components/DeleteAccountDialog';
import { useAuthStore, accountInitials, deleteAccount } from '@/lib/stores/auth.store';

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const displayName = user?.name?.trim() || 'Unnamed';
  const email = user?.email ?? '';
  const initials = accountInitials(user);

  useEffect(() => {
    document.title = 'Settings | EasyDraw';
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.push('/login');
    }
  };

  const handleDeleteAccount = async () => {
    await deleteAccount();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-panel">
      <header className="sticky top-0 z-30 border-b border-line bg-white/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              aria-label="Back to dashboard"
              className="flex size-9 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface-hover"
            >
              <ArrowLeft size={17} />
            </button>
            <Logo size="md" />
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
          >
            <LogOut size={17} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Settings</h1>
          <p className="mt-1 text-sm text-ink-muted">Manage your account information</p>
        </div>

        <section className="space-y-5 rounded-xl border border-line bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <User size={16} className="text-ink-muted" />
            <h2 className="text-sm font-semibold tracking-wider text-ink-muted uppercase">Profile</h2>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="flex size-16 flex-shrink-0 items-center justify-center rounded-full bg-mq-maroon text-lg font-semibold text-white"
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-ink">{displayName}</p>
              <p className="truncate text-sm text-ink-muted">{email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 text-sm text-ink-muted">
            <Calendar size={14} className="flex-shrink-0" />
            <span>Joined {formatDate(user?.createdAt)}</span>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-red-200 bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-600" />
            <h2 className="text-sm font-semibold tracking-wider text-red-600 uppercase">
              Danger Zone
            </h2>
          </div>

          <div className="flex flex-col justify-between gap-4 py-2 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Delete account</p>
              <p className="mt-0.5 text-xs leading-5 text-ink-muted">
                Delete your account, saved diagrams, and EasyDraw browser data on this device. This
                action cannot be undone.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              <Trash2 size={15} />
              Delete account
            </button>
          </div>
        </section>
      </main>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
