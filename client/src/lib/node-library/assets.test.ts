import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAssetCache, resolveAssetBlob, resolveAssetObjectUrl, waitForAssets } from './assets';
import { nodeLibraryApi } from './api';

vi.mock('./api', () => ({ nodeLibraryApi: { resolveAssets: vi.fn() } }));

describe('private image resolver', () => {
  beforeEach(() => {
    clearAssetCache();
    vi.mocked(nodeLibraryApi.resolveAssets).mockReset().mockImplementation(async (ids) => ({ assets: ids.map((id) => ({ id, url: `https://private.test/${id}?signature=signed`, expiresAt: '2030-01-01T00:00:00Z' })) }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['image'], { type: 'image/png' }), { status: 200 })));
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:private-image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });
  afterEach(() => { clearAssetCache(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('deduplicates requests and only exposes an in-memory blob URL', async () => {
    const [first, second] = await Promise.all([resolveAssetObjectUrl('asset-1'), resolveAssetObjectUrl('asset-1')]);
    expect(first).toBe('blob:private-image');
    expect(second).toBe(first);
    expect(nodeLibraryApi.resolveAssets).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://private.test/asset-1?signature=signed', expect.objectContaining({ credentials: 'omit', mode: 'cors' }));
    expect((await resolveAssetBlob('asset-1')).type).toBe('image/png');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('batches assets mounted together to avoid one API call per node', async () => {
    await Promise.all(Array.from({ length: 12 }, (_, index) => resolveAssetObjectUrl(`asset-${index}`)));
    expect(nodeLibraryApi.resolveAssets).toHaveBeenCalledTimes(1);
    expect(vi.mocked(nodeLibraryApi.resolveAssets).mock.calls[0][0]).toHaveLength(12);
    expect(fetch).toHaveBeenCalledTimes(12);
  });

  it('keeps image/thumbnail resolution separate and splits at 100 IDs', async () => {
    await Promise.all([
      ...Array.from({ length: 101 }, (_, index) => resolveAssetBlob(`asset-${index}`)),
      resolveAssetBlob('asset-0', 'thumbnail'),
    ]);
    expect(nodeLibraryApi.resolveAssets).toHaveBeenCalledTimes(3);
    expect(vi.mocked(nodeLibraryApi.resolveAssets).mock.calls.map((call) => [call[0].length, call[1]])).toEqual([[100, 'image'], [1, 'image'], [1, 'thumbnail']]);
  });

  it('resolves a new signature once after an expired signed URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 403 }));
    await resolveAssetObjectUrl('asset-2');
    expect(nodeLibraryApi.resolveAssets).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('revokes cached object URLs when the editor/session is disposed', async () => {
    await resolveAssetObjectUrl('asset-3');
    clearAssetCache();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-image');
    await resolveAssetObjectUrl('asset-3');
    expect(nodeLibraryApi.resolveAssets).toHaveBeenCalledTimes(2);
  });

  it('rejects unnormalized/active file formats and unavailable assets', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }));
    await expect(resolveAssetBlob('unsafe')).rejects.toThrow('unsupported image format');
    vi.mocked(nodeLibraryApi.resolveAssets).mockResolvedValueOnce({ assets: [] });
    await expect(resolveAssetBlob('missing')).rejects.toThrow('unavailable');
  });

  it('isolates missing IDs without hiding available images in the same batch', async () => {
    vi.mocked(nodeLibraryApi.resolveAssets).mockResolvedValueOnce({ assets: [{ id: 'available', url: 'https://private.test/available', expiresAt: '2030-01-01T00:00:00Z' }] });
    const result = await Promise.allSettled([resolveAssetObjectUrl('available'), resolveAssetObjectUrl('missing')]);
    expect(result[0]).toEqual({ status: 'fulfilled', value: 'blob:private-image' });
    expect(result[1].status).toBe('rejected');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not publish an old account download after cache reset', async () => {
    let release!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const result = resolveAssetObjectUrl('old-account');
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    clearAssetCache();
    release(new Response(new Blob(['image'], { type: 'image/png' })));
    await expect(result).rejects.toThrow('cancelled');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await expect(waitForAssets()).resolves.toBeUndefined();
  });
});
