'use client';

import { useEffect, useState } from 'react';
import { Loader2, LogOut, Monitor, Smartphone, Tablet } from 'lucide-react';
import {
  describeAddress,
  describeDevice,
  sessionsApi,
  timeAgo,
  type AccountSession,
  type DeviceKind,
} from '@/lib/account/sessions';

const DEVICE_ICON: Record<DeviceKind, typeof Monitor> = {
  phone: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <div className="size-10 flex-shrink-0 animate-pulse rounded-lg bg-surface-hover" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-40 animate-pulse rounded bg-surface-hover" />
        <div className="h-3 w-56 animate-pulse rounded bg-surface-hover" />
      </div>
    </div>
  );
}

function SessionRow({
  session,
  busy,
  onRevoke,
}: {
  session: AccountSession;
  busy: boolean;
  onRevoke: () => void;
}) {
  const { label, kind } = describeDevice(session.userAgent);
  const Icon = DEVICE_ICON[kind];
  const address = describeAddress(session.ipAddress);

  return (
    <div className="flex items-center gap-3 py-3.5">
      <div
        className={`flex size-10 flex-shrink-0 items-center justify-center rounded-lg ${
          session.current ? 'bg-mq-pink text-mq-red' : 'bg-surface-hover text-ink-muted'
        }`}
        aria-hidden="true"
      >
        <Icon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-sm font-medium text-ink">{label}</p>
          {session.current && (
            <span className="rounded-full bg-mq-pink px-2 py-0.5 text-[11px] font-semibold tracking-wide text-mq-red uppercase">
              This device
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-muted">
          {session.current ? 'Active now' : timeAgo(session.lastSeenAt)}
          {address && <span> · {address}</span>}
        </p>
      </div>

      {/* The current device signs out from the header button, which also clears
          this browser's cookie — revoking it from here would leave a dead page. */}
      {!session.current && (
        <button
          type="button"
          onClick={onRevoke}
          disabled={busy}
          aria-label={`Sign out ${label}`}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-mq-pink hover:text-mq-red disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          Sign out
        </button>
      )}
    </div>
  );
}

/**
 * The browsers currently holding a session for this account, and the means to
 * end any of them. This is what a session table buys over a signed token: the
 * owner can see every way in and close the ones they do not recognise.
 */
export default function SessionList() {
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  useEffect(() => {
    // Guarded so a response that lands after this section unmounts, or after a
    // second run in development, does not write to state that no longer exists.
    let live = true;

    sessionsApi
      .list()
      .then((list) => {
        if (live) setSessions(list);
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setError(cause instanceof Error ? cause.message : 'Could not load your devices.');
        setSessions([]);
      });

    return () => {
      live = false;
    };
  }, []);

  const revoke = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      await sessionsApi.revoke(id);
      // Drop it locally rather than refetching: the row is gone either way,
      // and the list should not flicker back through its loading state.
      setSessions((current) => current?.filter((session) => session.id !== id) ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign that device out.');
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    setRevokingOthers(true);
    setError('');
    try {
      await sessionsApi.revokeOthers();
      setSessions((current) => current?.filter((session) => session.current) ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign the other devices out.');
    } finally {
      setRevokingOthers(false);
    }
  };

  const others = sessions?.filter((session) => !session.current).length ?? 0;
  // The device you are reading this on belongs at the top, however long ago the
  // others were seen. Sorting is stable, so the rest keep the server's order.
  const ordered = sessions && [...sessions].sort((a, b) => Number(b.current) - Number(a.current));

  return (
    <section className="space-y-4 rounded-xl border border-line bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Monitor size={16} className="text-ink-muted" />
        <h2 className="text-sm font-semibold tracking-wider text-ink-muted uppercase">Devices</h2>
      </div>

      <p className="text-xs leading-5 text-ink-muted">
        Where your account is signed in. Sign out anything you do not recognise — it stops working
        straight away.
      </p>

      {error && (
        <p role="alert" className="rounded-lg bg-mq-pink px-3 py-2 text-sm text-mq-red">
          {error}
        </p>
      )}

      <div className="divide-y divide-line">
        {ordered === null ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : ordered.length === 0 ? (
          <p className="py-4 text-sm text-ink-muted">No active devices to show.</p>
        ) : (
          ordered.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              busy={busyId === session.id}
              onRevoke={() => void revoke(session.id)}
            />
          ))
        )}
      </div>

      {others > 0 && (
        <div className="flex flex-col justify-between gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
          <p className="text-xs text-ink-muted">
            {others === 1 ? '1 other device is' : `${others} other devices are`} signed in.
          </p>
          <button
            type="button"
            onClick={() => void revokeOthers()}
            disabled={revokingOthers}
            className="flex flex-shrink-0 items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-hover disabled:opacity-60"
          >
            {revokingOthers && <Loader2 size={15} className="animate-spin" />}
            Sign out all other devices
          </button>
        </div>
      )}
    </section>
  );
}
