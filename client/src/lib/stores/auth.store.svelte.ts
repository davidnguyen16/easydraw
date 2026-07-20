/**
 * Client-side auth state.
 *
 * The JWT lives in an httpOnly cookie the browser attaches automatically — JS
 * can't read it — so login state comes from the server via `fetchMe()`
 * (GET /auth/me). `ready` flips true once that first check resolves, letting
 * route guards tell "still checking" apart from "checked, not logged in".
 */
import { API_URL } from '$lib/api';
export type AuthUser = {
	id: string;
	email: string;
	name: string | null;
	/** ISO timestamp returned by GET /auth/me once the backend exposes it. */
	createdAt?: string;
};

/**
 * Avatar initials for a user — one source of truth so every avatar (editor
 * MenuBar, dashboard, settings, landing nav) shows the same thing:
 *   • a multi-word NAME → first letter of the first two words
 *     ("Mạnh duy Nguyễn" → "MD");
 *   • a single word, or a bare EMAIL → first two characters
 *     ("manhduy…@gmail.com" → "MA");
 *   • nothing → "U".
 */
export function accountInitials(user: AuthUser | null): string {
	const source = (user?.name?.trim() || user?.email || '').trim();
	const parts = source.split(/\s+/).filter(Boolean);
	if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
	return source.slice(0, 2).toUpperCase() || 'U';
}

let user = $state<AuthUser | null>(null);
let ready = $state(false);

export const authStore = {
	get user() {
		return user;
	},
	set user(value: AuthUser | null) {
		user = value;
	},
	get isAuthenticated() {
		return user !== null;
	},

	get ready() {
		return ready;
	}
};

export async function fetchMe(): Promise<void> {
	try {
		const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
		user = res.ok ? await res.json() : null;
	} catch {
		user = null;
	} finally {
		ready = true;
	}
}

/** Clear the server cookie + local user state. */
export async function logout(): Promise<void> {
	try {
		await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
	} finally {
		user = null;
	}
}

async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
	try {
		const body = (await response.json()) as { message?: string | string[] };
		if (Array.isArray(body.message)) return body.message.join(', ');
		if (typeof body.message === 'string' && body.message.trim()) return body.message;
	} catch {
		// The server may return an empty/non-JSON body. Use the stable fallback.
	}
	return fallback;
}

/**
 * Permanently delete the authenticated account.
 *
 * Backend contract: DELETE /auth/account, authenticated through the existing
 * httpOnly cookie. The endpoint must derive the user id from the JWT rather
 * than accepting an id from the browser.
 */
export async function deleteAccount(): Promise<void> {
	const response = await fetch(`${API_URL}/auth/account`, {
		method: 'DELETE',
		credentials: 'include'
	});

	if (!response.ok) {
		throw new Error(
			await apiErrorMessage(response, 'Could not delete account. Please try again.')
		);
	}

	// Clear both the server cookie (also harmless if DELETE already cleared it)
	// and the local auth state before the settings page redirects to login.
	try {
		await logout();
	} catch {
		// logout() clears local state in finally; deletion has already succeeded.
	}
}
