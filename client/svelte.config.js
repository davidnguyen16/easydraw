import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// EasyDraw is a pure client-side SPA that talks to the separate NestJS
		// API, so we ship static files with an index.html SPA fallback (any route
		// is served the shell and resolved on the client). No Node server needed.
		adapter: adapter({ fallback: 'index.html' })
	}
};

export default config;
