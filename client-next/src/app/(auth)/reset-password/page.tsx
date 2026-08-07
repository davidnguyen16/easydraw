'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, CircleCheck } from 'lucide-react';
import { API_URL } from '@/lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  // Reset token arrives as ?token=... in the emailed link.
  const token = useSearchParams().get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('This reset link is invalid or is missing its token.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        setError(
          res.status === 400
            ? 'This reset link is invalid or has expired. Please request a new one.'
            : 'Something went wrong. Please try again.',
        );
        return;
      }

      setDone(true);
      // Brief pause so the success message is seen, then off to sign in.
      setTimeout(() => router.push('/login'), 1800);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-center text-3xl font-bold text-ink">Reset your password</h1>
      <p className="mt-2 text-center text-ink-muted">Enter a new password for your account</p>

      <div className="mt-8 w-full rounded-2xl border border-line bg-white p-7 shadow-sm">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CircleCheck size={44} className="text-green-600" />
            <p className="text-sm text-ink-soft">
              Your password has been reset. Redirecting you to sign in…
            </p>
            <Link href="/login" className="text-sm font-medium text-mq-red hover:underline">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && (
              <p className="rounded-lg bg-mq-pink px-3 py-2 text-sm text-mq-red">{error}</p>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-ink">
                New Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your new password"
                  className="w-full rounded-lg border border-line py-2.5 pr-10 pl-10 text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-ink-muted">At least 8 characters</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm" className="text-sm font-medium text-ink">
                Confirm Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Re-enter your new password"
                  className="w-full rounded-lg border border-line py-2.5 pr-3 pl-10 text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-mq-maroon py-2.5 font-semibold text-white hover:bg-mq-red disabled:opacity-60"
            >
              {loading ? 'Resetting…' : 'Reset password'}
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

// useSearchParams() must sit under a Suspense boundary for static generation.
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
