import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * Static export — the whole app is client-rendered (no server components, API
 * routes, or middleware), so production ships as plain files exactly like the
 * SvelteKit `adapter-static` build it replaces. Keeps Amplify on cheap static
 * hosting and avoids depending on Amplify's Next.js SSR version support.
 *
 * `/editor/[id]` prerenders a single shell (see its generateStaticParams);
 * Amplify rewrites `/editor/<*>` onto that shell and the client reads the real
 * id from the URL — the same SPA-fallback trick SvelteKit used.
 *
 * Export is applied to BUILDS ONLY: under `output: 'export'` the dev server
 * rejects any id that isn't listed in generateStaticParams(), and real diagram
 * ids can't be enumerated. Dev therefore serves `/editor/<id>` dynamically,
 * which resolves to the same id because the page reads it from the live path.
 */
const nextConfig = (phase: string): NextConfig => {
  if (phase === PHASE_DEVELOPMENT_SERVER) return {};
  return { output: "export" };
};

export default nextConfig;
