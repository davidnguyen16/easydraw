// Base URL of the NestJS server. Client (5173) and server (3000) run on
// different ports in dev, so absolute URLs are needed for browser navigation
// (e.g. the Google OAuth redirect) and fetch calls.
// TODO: move to an env var (PUBLIC_API_URL) before deploying.
export const API_URL = 'http://localhost:3000';
