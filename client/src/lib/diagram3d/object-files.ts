import type { Visual3DRecipe } from '@easydraw/diagram-schema';

/**
 * 3D objects travel between accounts as small JSON files:
 * `{ "name": "…", "recipe": { "version": 2, "parts": […] } }`. The same file
 * shape lives in packages/objects-3d/recipes and is what the seed script
 * uploads, so a designed object, an exported one and a starter one are
 * interchangeable.
 */
export interface Object3DFile {
  name: string;
  recipe: unknown;
}

function safeFileName(name: string): string {
  return (name.trim() || 'object').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
}

export function downloadObjectFile(name: string, recipe: Visual3DRecipe): void {
  const blob = new Blob([JSON.stringify({ name: name.trim() || 'Object', recipe }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(name)}.object3d.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Opens a picker and parses the chosen file; resolves null when cancelled or unreadable. */
export function pickObjectFile(): Promise<Object3DFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
        const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim().slice(0, 100) : file.name.replace(/(\.object3d)?\.json$/i, '');
        resolve({ name, recipe: parsed.recipe ?? parsed });
      } catch {
        resolve({ name: file.name, recipe: null });
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
