'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/auth.store';
import { nodeLibraryApi } from './api';

type Variant = 'image' | 'thumbnail';
interface CacheEntry {
  id: string;
  variant: Variant;
  users: number;
  touched: number;
  blob?: Blob;
  url?: string;
  error?: Error;
  pending?: Promise<CacheEntry>;
  controller: AbortController;
}

const cache = new Map<string, CacheEntry>();
const MAX_IDLE_ENTRIES = 80;
const MAX_IDLE_BYTES = 32 * 1024 * 1024;
let generation = 0;
let activeDownloads = 0;
const waitingDownloads: Array<() => void> = [];
interface SignedAsset { id: string; url: string; expiresAt: string }
interface ResolveRequest {
  entry: CacheEntry;
  generation: number;
  resolve: (asset: SignedAsset) => void;
  reject: (error: Error) => void;
}
let resolveQueue: ResolveRequest[] = [];
let resolveScheduled = false;
const resolveControllers = new Set<AbortController>();

function cancelled() { return new DOMException('Asset request cancelled', 'AbortError'); }

/** One metadata request for up to 100 images mounted together, separately by variant. */
function resolveSignedAsset(entry: CacheEntry): Promise<SignedAsset> {
  if (entry.controller.signal.aborted) return Promise.reject(cancelled());
  const result = new Promise<SignedAsset>((resolve, reject) => resolveQueue.push({ entry, generation, resolve, reject }));
  if (!resolveScheduled) {
    resolveScheduled = true;
    queueMicrotask(flushResolutions);
  }
  return result;
}

function flushResolutions() {
  resolveScheduled = false;
  const requests = resolveQueue;
  resolveQueue = [];
  for (const variant of ['image', 'thumbnail'] as const) {
    const group = requests.filter((request) => request.entry.variant === variant);
    for (let offset = 0; offset < group.length; offset += 100) {
      const candidates = group.slice(offset, offset + 100);
      const batch = candidates.filter((request) => {
        if (request.entry.controller.signal.aborted || request.generation !== generation) { request.reject(cancelled()); return false; }
        return true;
      });
      if (!batch.length) continue;
      const controller = new AbortController();
      resolveControllers.add(controller);
      void nodeLibraryApi.resolveAssets(batch.map((request) => request.entry.id), variant, controller.signal).then((result) => {
        const assets = new Map(result.assets.map((asset) => [asset.id, asset]));
        for (const request of batch) {
          if (request.entry.controller.signal.aborted || request.generation !== generation) { request.reject(cancelled()); continue; }
          const asset = assets.get(request.entry.id);
          if (asset) request.resolve(asset);
          else request.reject(new Error('This custom image is unavailable or you no longer have access to it.'));
        }
      }).catch((error: unknown) => {
        for (const request of batch) request.reject(error instanceof Error ? error : new Error('Could not resolve custom images.'));
      }).finally(() => resolveControllers.delete(controller));
    }
  }
}

function discard(key: string, entry: CacheEntry) {
  entry.controller.abort();
  if (entry.url) URL.revokeObjectURL(entry.url);
  cache.delete(key);
}

function prune() {
  const idle = [...cache].filter(([, entry]) => entry.users === 0 && !entry.pending).sort((a, b) => a[1].touched - b[1].touched);
  let bytes = idle.reduce((sum, [, entry]) => sum + (entry.blob?.size ?? 0), 0);
  let count = idle.length;
  for (const [key, entry] of idle) {
    if (count <= MAX_IDLE_ENTRIES && bytes <= MAX_IDLE_BYTES) break;
    bytes -= entry.blob?.size ?? 0;
    count -= 1;
    discard(key, entry);
  }
}

/** Call on an account change or editor disposal; URLs never leave memory. */
export function clearAssetCache() {
  generation += 1;
  for (const controller of resolveControllers) controller.abort();
  resolveControllers.clear();
  for (const request of resolveQueue) request.reject(cancelled());
  resolveQueue = [];
  for (const [key, entry] of cache) discard(key, entry);
}

// This module is client-only, but guard the subscription for server rendering.
if (typeof window !== 'undefined') {
  useAuthStore.subscribe((state, previous) => {
    if (state.user?.id !== previous.user?.id) clearAssetCache();
  });
}

function entryFor(assetId: string, variant: Variant) {
  const key = `${variant}:${assetId}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = { id: assetId, variant, users: 0, touched: Date.now(), controller: new AbortController() };
    cache.set(key, entry);
  }
  entry.touched = Date.now();
  return entry;
}

async function withDownloadSlot<T>(action: () => Promise<T>): Promise<T> {
  if (activeDownloads >= 4) await new Promise<void>((resolve) => waitingDownloads.push(resolve));
  else activeDownloads += 1;
  try { return await action(); }
  finally {
    const next = waitingDownloads.shift();
    if (next) next();
    else activeDownloads -= 1;
  }
}

function load(entry: CacheEntry): Promise<CacheEntry> {
  if (entry.url && entry.blob) return Promise.resolve(entry);
  if (entry.pending) return entry.pending;
  const requestGeneration = generation;
  const signal = entry.controller.signal;
  entry.error = undefined;
  entry.pending = resolveSignedAsset(entry).then((firstUrl) => withDownloadSlot(async () => {
    if (signal.aborted) throw new DOMException('Asset request cancelled', 'AbortError');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const resolved = attempt === 0 ? firstUrl : await resolveSignedAsset(entry);
      const response = await fetch(resolved.url, { mode: 'cors', credentials: 'omit', signal });
      // A signed URL may expire in transit; resolve once more, never append query parameters.
      if ((response.status === 401 || response.status === 403) && attempt === 0) continue;
      if (!response.ok) throw new Error(`Could not load custom image (${response.status}).`);
      const blob = await response.blob();
      if (!/^image\/(png|jpeg|webp)$/.test(blob.type)) throw new Error('The custom image server returned an unsupported image format.');
      if (generation !== requestGeneration || signal.aborted) throw new DOMException('Asset request cancelled', 'AbortError');
      entry.blob = blob;
      entry.url = URL.createObjectURL(blob);
      return entry;
    }
    throw new Error('The custom image URL expired. Please try again.');
  })).catch((error: unknown) => {
    entry.error = error instanceof Error ? error : new Error('Could not load custom image.');
    throw entry.error;
  }).finally(() => {
    entry.pending = undefined;
    prune();
  });
  return entry.pending;
}

export async function resolveAssetBlob(assetId: string, variant: Variant = 'image'): Promise<Blob> {
  const entry = await load(entryFor(assetId, variant));
  return entry.blob!;
}

export async function resolveAssetObjectUrl(assetId: string, variant: Variant = 'image'): Promise<string> {
  const entry = await load(entryFor(assetId, variant));
  return entry.url!;
}

/** Exporters await image requests, then decode the actual DOM/Three.js images. */
export async function waitForAssets(): Promise<void> {
  const images = [...cache.values()].filter((entry) => entry.variant === 'image' && (entry.users > 0 || entry.pending));
  await Promise.all(images.map((entry) => entry.pending));
  const failed = images.find((entry) => entry.error);
  if (failed?.error) throw failed.error;
}

export function useAssetUrl(assetId: string | undefined, variant: Variant = 'image'): { url?: string; error?: string; loading: boolean } {
  const userId = useAuthStore((state) => state.user?.id);
  const requestKey = `${userId ?? ''}:${variant}:${assetId ?? ''}`;
  const [result, setResult] = useState<{ key: string; url?: string; error?: string }>({ key: '' });
  useEffect(() => {
    if (!assetId || !userId) return;
    let mounted = true;
    const entry = entryFor(assetId, variant);
    entry.users += 1;
    void load(entry).then(
      (loaded) => { if (mounted) setResult({ key: requestKey, url: loaded.url }); },
      (error: unknown) => { if (mounted) setResult({ key: requestKey, error: error instanceof Error ? error.message : 'Could not load custom image.' }); },
    );
    return () => {
      mounted = false;
      entry.users = Math.max(0, entry.users - 1);
      entry.touched = Date.now();
      prune();
    };
  }, [assetId, variant, userId, requestKey]);
  if (!assetId) return { error: 'This node has no image asset.', loading: false };
  if (!userId) return { error: 'Sign in to view your custom image.', loading: false };
  if (result.key !== requestKey) return { loading: true };
  return { url: result.url, error: result.error, loading: !result.url && !result.error };
}
