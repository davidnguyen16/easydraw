'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth.store';

// Kicks off the first GET /auth/me so `ready`/`user` populate app-wide. Port of
// the root +layout.svelte `onMount(fetchMe)`. Renders nothing.
export default function AuthInit() {
  useEffect(() => {
    useAuthStore.getState().fetchMe();
  }, []);
  return null;
}
