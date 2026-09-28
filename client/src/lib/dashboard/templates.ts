import { API_URL } from '@/lib/api';

/** A sample diagram published by an admin; every account can take a copy. */
export interface SampleTemplate {
  id: string;
  title: string;
  category: string | null;
  type: string;
  sortOrder: number;
  thumbnailAt: string | null;
  updatedAt: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const templatesApi = {
  list: () => request<SampleTemplate[]>('/templates'),
  use: (id: string) => request<{ id: string }>(`/templates/${id}/use`, { method: 'POST' }),
  publish: (diagramId: string) => request<SampleTemplate>('/templates', { method: 'POST', body: JSON.stringify({ diagramId }) }),
  remove: (id: string) => request<void>(`/templates/${id}`, { method: 'DELETE' }),
};

/** Versioned by `thumbnailAt`, so the browser cache serves unchanged pictures for a day. */
export function templateThumbnailUrl(template: Pick<SampleTemplate, 'id' | 'thumbnailAt'>): string | null {
  return template.thumbnailAt ? `${API_URL}/templates/${template.id}/thumbnail?v=${encodeURIComponent(template.thumbnailAt)}` : null;
}

export function diagramThumbnailUrl(doc: { id: string; thumbnailAt?: string | null }): string | null {
  return doc.thumbnailAt ? `${API_URL}/diagrams/${doc.id}/thumbnail?v=${encodeURIComponent(doc.thumbnailAt)}` : null;
}
