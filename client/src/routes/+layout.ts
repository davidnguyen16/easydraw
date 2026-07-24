// Render entirely on the client — no SSR/prerender. The app is a SPA backed by
// the separate NestJS API, so pages resolve in the browser (needed for the
// adapter-static SPA fallback).
export const ssr = false;
