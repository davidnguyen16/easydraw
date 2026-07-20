import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Rollup } from 'vite';

// @xyflow/svelte's dist re-exports `handleConnectionChange` from @xyflow/system
// without ever using it. That's a third-party issue we can't fix here, so we
// swallow just that one warning and forward everything else to Rollup's default
// handler. SvelteKit runs the SSR and client builds separately, so this is wired
// into both environments below.
function onwarn(warning: Rollup.RollupLog, defaultHandler: Rollup.LoggingFunction) {
	if (
		warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
		warning.message.includes('handleConnectionChange')
	) {
		return;
	}
	defaultHandler(warning);
}

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		// Our entry pulls in @xyflow/svelte + jspdf up front, so the main chunk
		// sits a little above Rollup's default 500 kB notice. Raise the threshold
		// to match reality. (This only quiets the warning; it doesn't shrink the
		// bundle — lazy-loading the export libs would be the real win.)
		chunkSizeWarningLimit: 900,
		rollupOptions: { onwarn }
	},
	environments: {
		ssr: {
			build: {
				rollupOptions: { onwarn }
			}
		}
	}
});
