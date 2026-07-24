// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Build-time env vars (Vite inlines VITE_-prefixed values).
	interface ImportMetaEnv {
		readonly VITE_API_URL?: string;
	}
}

export {};
