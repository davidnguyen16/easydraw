import { describe, expect, it, vi } from 'vitest';
import { validateVisual3DRecipe, type Visual3DRecipe } from '@easydraw/diagram-schema';
import { MAX_OBJECT_FOLDER_FILE_BYTES, MAX_OBJECT_FOLDER_JSON_FILES, parseObjectFolderFiles } from './object-folder-import';

const recipe = (): Visual3DRecipe => ({
  version: 2,
  size: { width: 60, height: 100, depth: 2 },
  fill: '#273545',
  parts: [{ shape: 'box', material: 'body', size: [1, 1, 1], position: [0, 0, 0] }],
});

function file(name: string, contents: string, path = name, size = new TextEncoder().encode(contents).length) {
  return { name, webkitRelativePath: path, size, text: vi.fn(async () => contents) };
}

describe('local 3D object folder preview', () => {
  it('accepts wrapped and bare recipes, nested paths and case-insensitive JSON names', async () => {
    const files = [
      file('rack.JSON', JSON.stringify({ id: 'rack', name: '  Server rack  ', group: 'Data centre', recipe: recipe() }), 'objects/z/rack.JSON'),
      file('server.object3d.json', JSON.stringify(recipe()), 'objects/a/server.object3d.json'),
      file('readme.md', 'Not JSON', 'objects/readme.md'),
    ];
    const result = await parseObjectFolderFiles(files);
    expect(result.map(({ path }) => path)).toEqual(['objects/a/server.object3d.json', 'objects/z/rack.JSON']);
    expect(result.map(({ name }) => name)).toEqual(['server', 'Server rack']);
    expect(result.every(({ recipe, error }) => recipe && validateVisual3DRecipe(recipe).valid && !error)).toBe(true);
    expect(files[2].text).not.toHaveBeenCalled();
    expect(await parseObjectFolderFiles(files)).toEqual(result);
  });

  it('keeps malformed, primitive, array and unreadable files as individual errors', async () => {
    const unreadable = file('unreadable.json', '');
    unreadable.text.mockRejectedValue(new Error('Read failed'));
    const files = [file('good.json', JSON.stringify(recipe())), file('malformed.json', '{'),
      file('primitive.json', '42'), file('array.json', '[]'), file('null.json', 'null'), unreadable];
    const result = await parseObjectFolderFiles(files);
    expect(result).toHaveLength(files.length);
    expect(result.find(({ path }) => path === 'good.json')?.recipe).not.toBeNull();
    expect(result.filter(({ error }) => error)).toHaveLength(5);
    expect(result.find(({ path }) => path === 'malformed.json')?.error).toContain('invalid JSON');
    expect(result.find(({ path }) => path === 'primitive.json')?.error).toContain('JSON object');
    expect(result.find(({ path }) => path === 'unreadable.json')?.error).toContain('Could not read');
  });

  it('rejects oversized files before reading while allowing the byte-limit boundary', async () => {
    const oversized = file('huge.json', JSON.stringify(recipe()), 'huge.json', MAX_OBJECT_FOLDER_FILE_BYTES + 1);
    const boundary = file('boundary.json', JSON.stringify(recipe()), 'boundary.json', MAX_OBJECT_FOLDER_FILE_BYTES);
    const result = await parseObjectFolderFiles([oversized, boundary]);
    expect(oversized.text).not.toHaveBeenCalled();
    expect(result.find(({ path }) => path === 'huge.json')).toMatchObject({ recipe: null, error: expect.stringContaining('2 MiB') });
    expect(result.find(({ path }) => path === 'boundary.json')?.recipe).toEqual(recipe());
  });

  it('rejects empty or oversized JSON batches before reading any files', async () => {
    await expect(parseObjectFolderFiles([])).rejects.toThrow('No JSON object files');
    const image = file('preview.png', 'Not JSON');
    await expect(parseObjectFolderFiles([image])).rejects.toThrow('No JSON object files');
    expect(image.text).not.toHaveBeenCalled();
    const oversized = Array.from({ length: MAX_OBJECT_FOLDER_JSON_FILES + 1 }, (_, index) =>
      file(`${index}.json`, JSON.stringify(recipe())));
    await expect(parseObjectFolderFiles(oversized)).rejects.toThrow('up to 200 JSON');
    expect(oversized.every(({ text }) => text.mock.calls.length === 0)).toBe(true);
  });

  it('enforces recipe bounds without losing valid neighbours', async () => {
    const invalidExtent = recipe();
    invalidExtent.parts[0].size[0] = 3;
    const invalidPosition = recipe();
    invalidPosition.parts[0].position[0] = 2;
    const invalidParts = recipe();
    invalidParts.parts = Array.from({ length: 129 }, () => recipe().parts[0]);
    const result = await parseObjectFolderFiles([
      file('valid.json', JSON.stringify(recipe())), file('extent.json', JSON.stringify(invalidExtent)),
      file('position.json', JSON.stringify(invalidPosition)), file('parts.json', JSON.stringify(invalidParts)),
      file('mesh.json', JSON.stringify({ version: 2, parts: [{ ...recipe().parts[0], shape: 'mesh' }] })),
    ]);
    expect(result.filter(({ recipe }) => recipe)).toHaveLength(1);
    expect(result.filter(({ error, recipe }) => error && recipe === null)).toHaveLength(4);
  });

  it('preserves Unicode names without splitting characters and returns independent bounded copies', async () => {
    const wrapped = { name: `  ${'🦊'.repeat(101)}  `, recipe: { ...recipe(), unrelated: 'discard me' } };
    const source = file('fallback.json', `\uFEFF${JSON.stringify(wrapped)}`, '');
    const [first, second] = await parseObjectFolderFiles([source, source]);
    expect(Array.from(first.name)).toHaveLength(100);
    expect(first.name).toBe('🦊'.repeat(100));
    expect(first.path).toBe('fallback.json');
    expect(first.id).not.toBe(second.id);
    expect(first.recipe).not.toHaveProperty('unrelated');
    first.recipe!.parts[0].position[0] = 0.5;
    first.recipe!.size!.width = 120;
    expect(second.recipe).toEqual(recipe());
    expect((await parseObjectFolderFiles([source]))[0].recipe).toEqual(recipe());
  });
});
