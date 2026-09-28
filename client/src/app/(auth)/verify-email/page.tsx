'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';
import { API_URL } from '@/lib/api';

type State =
  | { status: 'working' }
  | { status: 'done'; email: string }
  | { status: 'failed'; message: string };

function VerifyEmail() {
  // Verification token arrives as ?token=... in the emailed link.
  const token = useSearchParams().get('token');
  // A link with no token is already answered before anything is sent.
  const [state, setState] = useState<State>(() =>
    token ? { status: 'working' } : { status: 'failed', message: 'This link is missing its token.' },
  );
  // The token is spent on first use, so a second call would fail. In
  // development React mounts effects twice; without this, the retry loses.
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;

    fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setState({ status: 'done', email: data.email });
          return;
        }
        setState({
          status: 'failed',
          message:
            res.status === 409
              ? 'That address now belongs to another account.'
              : 'This link is invalid or has expired. Ask for a new one from your account settings.',
        });
      })
      .catch(() => {
        setState({
          status: 'failed',
          message: 'Could not reach EasyDraw. Check your connection and try again.',
        });
      });
  }, [token]);

  return (
    <>
      <h1 className="text-center text-3xl font-bold text-ink">Confirm your email</h1>
      <p className="mt-2 text-center text-ink-muted">
        {state.status === 'working' ? 'Checking your link…' : 'EasyDraw account'}
      </p>

      <div className="mt-8 w-full rounded-2xl border border-line bg-white p-7 shadow-sm">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          {state.status === 'working' && (
            <>
              <LoaderCircle size={44} className="animate-spin text-ink-muted" />
              <p className="text-sm text-ink-soft">One moment…</p>
            </>
          )}

          {state.status === 'done' && (
            <>
              <CircleCheck size={44} className="text-green-600" />
              <p className="text-sm text-ink-soft">
                <span className="font-medium text-ink">{state.email}</span> is confirmed.
                We can now reach you about your account.
              </p>
              <Link
                href="/dashboard"
                className="mt-1 text-sm font-medium text-mq-red hover:underline"
              >
                Go to your diagrams
              </Link>
            </>
          )}

          {state.status === 'failed' && (
            <>
              <CircleX size={44} className="text-mq-red" />
              <p className="text-sm text-ink-soft">{state.message}</p>
              <Link
                href="/login"
                className="mt-1 text-sm font-medium text-mq-red hover:underline"
              >
                Go to sign in
              </Link>
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/login" className="font-medium text-mq-red hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </>
  );
}

// useSearchParams() must sit under a Suspense boundary for static generation.
export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
