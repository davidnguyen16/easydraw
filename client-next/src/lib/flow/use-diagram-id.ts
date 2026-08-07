'use client';

import { usePathname } from 'next/navigation';

/**
 * The diagram id from the URL.
 *
 * Static export prerenders a SINGLE `/editor/[id]` shell and the host rewrites
 * every `/editor/<id>` onto it, so `useParams()` would report the build-time
 * placeholder. Read the live browser path instead — the same way the SvelteKit
 * `adapter-static` SPA fallback resolved its route params.
 */
export function useDiagramId(): string {
  const pathname = usePathname() ?? '';
  const segments = pathname.split('/').filter(Boolean);
  const index = segments.indexOf('editor');
  return index >= 0 ? (segments[index + 1] ?? '') : '';
}
