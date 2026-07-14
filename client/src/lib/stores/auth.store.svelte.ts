/**
 * Client-side auth state.
 *
 * The JWT lives in an httpOnly cookie the browser attaches automatically — JS
 * can't read it — so login state comes from the server via `fetchMe()`
 * (GET /auth/me). `ready` flips true once that first check resolves, letting
 * route guards tell "still checking" apart from "checked, not logged in".
 */
import { API_URL } from '$lib/api';
export type AuthUser = { id: string; email: string; name: string | null };

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
		user = res.ok ? await res.json(): null;
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
