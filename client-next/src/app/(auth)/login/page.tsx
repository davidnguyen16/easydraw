'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { API_URL } from '@/lib/api';
import GoogleIcon from '@/lib/components/icons/GoogleIcon';
import { useAuthStore } from '@/lib/stores/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      setError('Email or password is incorrect');
      return;
    }

    const data = await res.json();
    setUser(data.user);
    router.push('/dashboard');
  }

  return (
    <>
      <h1 className="text-center text-3xl font-bold text-ink">Start designing your diagrams</h1>
      <p className="mt-2 text-center text-ink-muted">Sign in to EasyDraw</p>

      <div className="mt-8 w-full rounded-2xl border border-line bg-white p-7 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
                placeholder="you@example.com"
                className="w-full rounded-lg border border-line py-2.5 pr-3 pl-10 text-ink outline-none placeholder:text-ink-muted focus:border-mq-red focus:ring-1 focus:ring-mq-red"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-ink">Password</label>
              <Link href="/forgot-password" className="text-sm text-mq-red hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
          </div>

          <button
            type="submit"
            className="mt-1 w-full rounded-lg bg-mq-maroon py-2.5 font-semibold text-white hover:bg-mq-red"
          >
            Sign in
          </button>
        </form>

        {error && <p className="rounded-lg bg-mq-pink px-3 py-2 text-mq-red">{error}</p>}

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-ink-muted">OR</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <a
          href={`${API_URL}/auth/google`}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-white py-2.5 font-medium text-ink hover:bg-surface-hover"
        >
          <GoogleIcon />
          Continue with Google
        </a>
        <p className="mt-3 text-center text-xs leading-5 text-ink-muted">
          If you are new, continuing with Google creates an account. By continuing, you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-ink">Terms</Link> and acknowledge our{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">Privacy Policy</Link>.
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        New to EasyDraw?{' '}
        <Link href="/register" className="font-medium text-mq-red hover:underline">Create an account</Link>
      </p>
    </>
  );
}
