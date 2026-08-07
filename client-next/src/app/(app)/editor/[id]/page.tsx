import EditorClient from './EditorClient';

/**
 * Static export prerenders ONE shell for this dynamic route (diagram ids are
 * user data — they can't be enumerated at build time). The host rewrites every
 * `/editor/<id>` onto this shell and EditorClient reads the real id from the
 * live URL, mirroring the SvelteKit adapter-static SPA fallback.
 */
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function EditorPage() {
  return <EditorClient />;
}
