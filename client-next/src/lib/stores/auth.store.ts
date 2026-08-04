import { create } from 'zustand';
import { API_URL } from '@/lib/api';
import { clearEasyDrawBrowserData } from '@/lib/privacy/browser-data';

/**
 * Client-side auth state (Zustand port of auth.store.svelte.ts).
 *
 * The JWT lives in an httpOnly cookie the browser attaches automatically — JS
 * can't read it — so login state comes from the server via `fetchMe()`
 * (GET /auth/me). `ready` flips true once that first check resolves, letting
 * route guards tell "still checking" apart from "checked, not logged in".
 */
export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt?: string;
};

/**
 * Avatar initials for a user — one source of truth so every avatar shows the
 * same thing (multi-word name → first two initials; single word / email →
 * first two chars; nothing → "U").
 */
export function accountInitials(user: AuthUser | null): string {
  const source = (user?.name?.trim() || user?.email || '').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase() || 'U';
}

type AuthState = {
  user: AuthUser | null;
  ready: boolean;
  setUser: (user: AuthUser | null) => void;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  fetchMe: async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
      set({ user: res.ok ? await res.json() : null });
    } catch {
      set({ user: null });
    } finally {
      set({ ready: true });
    }
  },
  logout: async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } finally {
      set({ user: null });
    }
  },
}));

async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
  } catch {
    // The server may return an empty / non-JSON body. Use the stable fallback.
  }
  return fallback;
}

/**
 * Permanently delete the authenticated account. Backend derives the user id
 * from the JWT cookie; then wipe local EasyDraw storage + auth state.
 */
export async function deleteAccount(): Promise<void> {
  const response = await fetch(`${API_URL}/auth/account`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response, 'Could not delete account. Please try again.'));
  }

  clearEasyDrawBrowserData();

  try {
    await useAuthStore.getState().logout();
  } catch {
    // logout() clears local state in its finally; deletion already succeeded.
  }
}
