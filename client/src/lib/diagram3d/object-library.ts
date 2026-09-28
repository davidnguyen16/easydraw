import { create } from 'zustand';
import type { Visual3DRecipe } from '@easydraw/diagram-schema';
import { API_URL } from '@/lib/api';
import { renderObjectThumbnail } from './object-thumbnail';

/** A 3D look saved to the account: the recipe plus a name, filed in one of the private libraries. */
export interface Object3DTemplate {
  id: string;
  sectionId: string;
  name: string;
  recipe: Visual3DRecipe;
  updatedAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/object-library${path}`, {
    credentials: 'include',
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const objectLibraryApi = {
  list: () => request<Object3DTemplate[]>('/objects'),
  create: (sectionId: string, name: string, recipe: Visual3DRecipe) => request<Object3DTemplate>('/objects', { method: 'POST', body: JSON.stringify({ sectionId, name, recipe }) }),
  update: (id: string, patch: { name?: string; sectionId?: string }) => request<Object3DTemplate>(`/objects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => request<void>(`/objects/${id}`, { method: 'DELETE' }),
};

/**
 * The account's private 3D objects, shared by the sidebar libraries and the
 * Object tab so a save in one shows up in the other. Thumbnails are
 * rendered once per recipe and kept alongside. `librariesVersion` ticks when
 * the Object tab creates a library, so the sidebar reloads its sections.
 */
interface ObjectLibraryState {
  templates: Object3DTemplate[] | null;
  thumbnails: Record<string, string>;
  error: string | null;
  librariesVersion: number;
  load(): Promise<void>;
  add(sectionId: string, name: string, recipe: Visual3DRecipe): Promise<Object3DTemplate>;
  update(id: string, patch: { name?: string; sectionId?: string }): Promise<void>;
  remove(id: string): Promise<void>;
  librariesChanged(): void;
}

export const useObjectLibrary = create<ObjectLibraryState>((set, get) => ({
  templates: null,
  thumbnails: {},
  error: null,
  librariesVersion: 0,

  async load() {
    try {
      const templates = await objectLibraryApi.list();
      set({ templates, error: null });
      get().templates?.forEach((template) => thumbnailFor(template, set, get));
    } catch (error) {
      set({ templates: get().templates ?? [], error: error instanceof Error ? error.message : 'Could not load your 3D objects.' });
    }
  },

  async add(sectionId, name, recipe) {
    const created = await objectLibraryApi.create(sectionId, name, recipe);
    set((s) => ({ templates: [created, ...(s.templates ?? [])] }));
    thumbnailFor(created, set, get);
    return created;
  },

  async update(id, patch) {
    const updated = await objectLibraryApi.update(id, patch);
    set((s) => ({ templates: (s.templates ?? []).map((t) => (t.id === id ? updated : t)) }));
  },

  async remove(id) {
    await objectLibraryApi.remove(id);
    set((s) => ({ templates: (s.templates ?? []).filter((t) => t.id !== id) }));
  },

  librariesChanged() {
    set((s) => ({ librariesVersion: s.librariesVersion + 1 }));
  },
}));

type Set = (partial: Partial<ObjectLibraryState> | ((s: ObjectLibraryState) => Partial<ObjectLibraryState>)) => void;
type Get = () => ObjectLibraryState;

function thumbnailFor(template: Object3DTemplate, set: Set, get: Get): void {
  if (get().thumbnails[template.id]) return;
  // Off the critical path: the palette can show names first, pictures a frame later.
  requestAnimationFrame(() => {
    const url = renderObjectThumbnail(template.recipe);
    if (url) set((s) => ({ thumbnails: { ...s.thumbnails, [template.id]: url } }));
  });
}
