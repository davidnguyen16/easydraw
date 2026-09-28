import { API_URL } from '@/lib/api';

export interface LibraryAsset {
  id: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface LibraryNode {
  id: string;
  sectionId: string;
  assetId: string;
  name: string;
  defaultWidth: number;
  defaultHeight: number;
  sortOrder: number;
  asset: LibraryAsset;
}

export interface LibrarySection {
  id: string;
  name: string;
  sortOrder: number;
  nodes: LibraryNode[];
}

export class NodeLibraryError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'NodeLibraryError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/node-library${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (!response.ok) {
    let message = response.status === 503
      ? 'Custom libraries are not configured yet. Ask your administrator to connect Amazon S3.'
      : `Could not complete this library action (${response.status}).`;
    try {
      const body = await response.json() as { message?: string | string[] };
      if (typeof body.message === 'string') message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join(', ');
    } catch { /* Use the stable fallback for non-JSON responses. */ }
    throw new NodeLibraryError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const pathId = (id: string) => encodeURIComponent(id);
const MIME_BY_EXTENSION: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' };

export const nodeLibraryApi = {
  list: (signal?: AbortSignal) => request<{ sections: LibrarySection[] }>('/sections', { signal }),
  createSection: (name: string) => request<LibrarySection>('/sections', { method: 'POST', body: JSON.stringify({ name }) }),
  updateSection: (id: string, patch: { name?: string; sortOrder?: number }) => request<LibrarySection>(`/sections/${pathId(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteSection: (id: string) => request<void>(`/sections/${pathId(id)}`, { method: 'DELETE' }),
  updateNode: (id: string, patch: { name?: string; sectionId?: string; sortOrder?: number }) => request<LibraryNode>(`/nodes/${pathId(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteNode: (id: string) => request<void>(`/nodes/${pathId(id)}`, { method: 'DELETE' }),
  beginUpload: (sectionId: string, file: File) => request<{ assetId: string; url: string; fields: Record<string, string> }>(`/sections/${pathId(sectionId)}/uploads`, {
    method: 'POST',
    body: JSON.stringify({
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Custom node',
      fileName: file.name,
      contentType: file.type || MIME_BY_EXTENSION[file.name.split('.').at(-1)?.toLowerCase() ?? ''] || 'application/octet-stream',
      byteSize: file.size,
    }),
  }),
  completeUpload: (assetId: string) => request<LibraryNode>(`/uploads/${pathId(assetId)}/complete`, { method: 'POST' }),
  resolveAssets: (assetIds: string[], variant: 'image' | 'thumbnail', signal?: AbortSignal) => request<{ assets: Array<{ id: string; url: string; expiresAt: string }> }>('/assets/resolve', {
    method: 'POST', body: JSON.stringify({ assetIds, variant }), signal,
  }),
};

/** S3 handles the file transfer; application cookies must never accompany it. */
export function uploadToS3(url: string, fields: Record<string, string>, file: File, onProgress: (percent: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    form.append('file', file); // S3 POST requires the file field last.
    xhr.open('POST', url);
    xhr.withCredentials = false;
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => xhr.abort();
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('S3 rejected this upload. Please try again or check the bucket configuration.'));
    };
    xhr.onerror = () => { cleanup(); reject(new Error('Upload failed. Check your connection and S3 CORS configuration.')); };
    xhr.ontimeout = () => { cleanup(); reject(new Error('Upload timed out. Please try again.')); };
    xhr.onabort = () => { cleanup(); reject(new DOMException('Upload cancelled', 'AbortError')); };
    if (signal?.aborted) { reject(new DOMException('Upload cancelled', 'AbortError')); return; }
    signal?.addEventListener('abort', abort, { once: true });
    xhr.send(form);
  });
}
