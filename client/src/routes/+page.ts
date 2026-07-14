import { redirect } from '@sveltejs/kit';

// The marketing landing page was removed — send visitors straight to sign in.
// TODO: once auth.store is hydrated from the server, redirect to /dashboard
// when already logged in.
export const load = () => {
	throw redirect(307, '/login');
};
