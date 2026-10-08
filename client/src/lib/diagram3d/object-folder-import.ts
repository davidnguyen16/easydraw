import { cloneVisual3DRecipe, validateVisual3DRecipe, type Visual3DRecipe } from '@easydraw/diagram-schema';

export const MAX_OBJECT_FOLDER_JSON_FILES = 200;
export const MAX_OBJECT_FOLDER_FILE_BYTES = 2 * 1024 * 1024;

export interface ObjectFolderCandidate {
  id: string;
  path: string;
  name: string;
  recipe: Visual3DRecipe | null;
  error?: string;
}

type FolderFile = Pick<File, 'name' | 'size' | 'webkitRelativePath' | 'text'>;

function objectName(name: string): string {
  // Keep Unicode characters intact when bounding a user-visible object name.
  return Array.from(name.trim()).slice(0, 100).join('') || 'Object';
}

/** Parses local JSON independently so one bad file cannot hide valid objects.
 * Only validated copies leave this function; it performs no network requests. */
export async function parseObjectFolderFiles(files: readonly FolderFile[]): Promise<ObjectFolderCandidate[]> {
  const jsonFiles = files.filter(({ name }) => /\.json$/i.test(name));
  if (!jsonFiles.length) throw new Error('No JSON object files were found in this folder.');
  if (jsonFiles.length > MAX_OBJECT_FOLDER_JSON_FILES) {
    throw new Error(`Import up to ${MAX_OBJECT_FOLDER_JSON_FILES} JSON object files at a time. This folder contains ${jsonFiles.length}.`);
  }
  const sorted = jsonFiles.map((file, order) => ({ file, order, path: file.webkitRelativePath || file.name }))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : left.order - right.order);
  const candidates: ObjectFolderCandidate[] = [];
  for (const [index, { file, path }] of sorted.entries()) {
    const candidate: ObjectFolderCandidate = {
      id: `${path}:${index}`, path,
      name: objectName(file.name.replace(/(\.object3d)?\.json$/i, '')),
      recipe: null,
    };
    candidates.push(candidate);
    if (file.size > MAX_OBJECT_FOLDER_FILE_BYTES) {
      candidate.error = 'This JSON file is larger than 2 MiB.';
      continue;
    }
    let contents: string;
    try { contents = await file.text(); }
    catch {
      candidate.error = 'Could not read this JSON file.';
      continue;
    }
    let parsed: unknown;
    try { parsed = JSON.parse(contents.replace(/^\uFEFF/, '')); }
    catch {
      candidate.error = 'This file contains invalid JSON.';
      continue;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      candidate.error = 'A 3D object file must contain a JSON object.';
      continue;
    }
    const object = parsed as Record<string, unknown>;
    if (typeof object.name === 'string' && object.name.trim()) candidate.name = objectName(object.name);
    const recipe = object.recipe ?? object;
    const validation = validateVisual3DRecipe(recipe);
    if (!validation.valid) {
      candidate.error = `Not a 3D object file: ${validation.issues[0]?.message ?? 'invalid recipe'}`;
      continue;
    }
    candidate.recipe = cloneVisual3DRecipe(recipe as Visual3DRecipe);
  }
  return candidates;
}
