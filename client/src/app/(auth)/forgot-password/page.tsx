'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { API_URL } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // The server always responds the same way (anti-enumeration), so we show
      // one confirmation regardless of whether the account exists.
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-center text-3xl font-bold text-ink">Forgot your password?</h1>
      <p className="mt-2 text-center text-ink-muted">We&apos;ll email you a link to reset it</p>

      <div className="mt-8 w-full rounded-2xl border border-line bg-white p-7 shadow-sm">
        {sent ? (
          <div className="rounded-lg border border-line bg-panel p-4 text-sm text-ink-soft">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your
            inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <p className="rounded-lg bg-mq-pink px-3 py-2 text-sm text-mq-red">{error}</p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-ink">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-line py-2.5 pr-3 pl-10 text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-mq-maroon py-2.5 font-semibold text-white hover:bg-mq-red disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/login" className="font-medium text-mq-red hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </>
  );
}
