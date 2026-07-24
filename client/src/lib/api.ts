// Base URL of the NestJS server. Client (5173) and server (3000) run on
// different ports/hosts, so absolute URLs are needed for browser navigation
// (e.g. the Google OAuth redirect) and fetch calls.
// Baked in at build time via VITE_API_URL; falls back to the dockerised local
// server. In production (Amplify) set VITE_API_URL to the deployed API URL.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
