'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { API_URL } from '@/lib/api';
import GoogleIcon from '@/lib/components/icons/GoogleIcon';
import { useAuthStore } from '@/lib/stores/auth.store';

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const policyCheckbox = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError(res.status === 409 ? 'Email already in use' : 'Something went wrong');
        return;
      }

      const data = await res.json();
      setUser(data.user);
      router.push('/dashboard');
    } catch {
      setError('Could not create your account. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoogleSignUp(event: React.MouseEvent) {
    if (acceptedPolicies) return;
    event.preventDefault();
    policyCheckbox.current?.focus();
    policyCheckbox.current?.reportValidity();
  }

  return (
    <>
      <h1 className="text-center text-3xl font-bold text-ink">Create your account</h1>
      <p className="mt-2 text-center text-ink-muted">Sign up to get started</p>

      <div className="mt-8 w-full rounded-2xl border border-line bg-white p-7 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <p className="rounded-lg bg-mq-pink px-3 py-2 text-sm text-mq-red" role="alert">{error}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-ink">Email</label>
            <div className="relative">
              <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-line py-2.5 pr-3 pl-10 text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-ink">Password</label>
            <div className="relative">
              <Lock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Enter your password"
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
            <label htmlFor="confirm" className="text-sm font-medium text-ink">Confirm Password</label>
            <div className="relative">
              <Lock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                id="confirm"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                className="w-full rounded-lg border border-line py-2.5 pr-10 pl-10 text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-line-soft bg-panel/70 p-3.5">
            <div className="flex items-start gap-3">
              <input
                ref={policyCheckbox}
                id="policy-consent"
                type="checkbox"
                checked={acceptedPolicies}
                onChange={(e) => setAcceptedPolicies(e.target.checked)}
                required
                aria-describedby="policy-consent-help"
                className="mt-0.5 size-4 flex-shrink-0 cursor-pointer accent-mq-red"
              />
              <label htmlFor="policy-consent" className="cursor-pointer text-sm leading-5 text-ink">
                I agree to the{' '}
                <Link href="/terms" target="_blank" rel="noreferrer" className="font-medium text-mq-red underline underline-offset-2 hover:text-mq-maroon">
                  Terms of Service
                </Link>{' '}
                and acknowledge the{' '}
                <Link href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-mq-red underline underline-offset-2 hover:text-mq-maroon">
                  Privacy Policy
                </Link>.
              </label>
            </div>
            <p id="policy-consent-help" className="mt-2 pl-7 text-xs leading-5 text-ink-muted">
              Required to create an EasyDraw account.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-mq-maroon py-2.5 font-semibold text-white transition-colors hover:bg-mq-red disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
                Creating account…
              </>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-ink-muted">OR</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <a
          href={`${API_URL}/auth/google`}
          onClick={handleGoogleSignUp}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-white py-2.5 font-medium text-ink transition-colors hover:bg-surface-hover"
        >
          <GoogleIcon />
          Continue with Google
        </a>
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-mq-red hover:underline">Sign in</Link>
      </p>
    </>
  );
}
