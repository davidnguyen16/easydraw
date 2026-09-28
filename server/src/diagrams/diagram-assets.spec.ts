import {
  collectDiagramAssetIds,
  lockDiagramOwner,
  syncDiagramAssets,
  validateDiagramAssets,
} from './diagram-assets';
import type { Prisma } from '../generated/prisma/client';

const custom = (assetId: string) => ({
  id: assetId,
  type: 'CustomImageNode',
  data: {
    assetId,
    label: 'Robot',
    intrinsicWidth: 200,
    intrinsicHeight: 100,
    fit: 'contain',
  },
});
function setup() {
  const tx = {
    $queryRaw: jest
      .fn<Promise<{ id: string }[]>, [TemplateStringsArray, string]>()
      .mockResolvedValue([{ id: 'owner' }]),
    asset: {
      findMany: jest.fn(),
      updateMany: jest
        .fn<Promise<{ count: number }>, [Prisma.AssetUpdateManyArgs]>()
        .mockResolvedValue({ count: 1 }),
    },
    diagramAsset: {
      findMany: jest.fn().mockResolvedValue([{ assetId: 'old-image' }]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { tx, db: tx as unknown as Prisma.TransactionClient };
}

describe('diagram image references', () => {
  it('accepts documents whose shape it does not model', () => {
    for (const data of [
      {},
      { nodes: [{ id: 'legacy' }], edges: [] },
      { kind: 'something-else' },
    ]) {
      expect(collectDiagramAssetIds(data)).toEqual([]);
    }
  });
  it('collects all pages, deduplicates and sorts without mutation', () => {
    const document = {
      pages: [{ nodes: [custom('b'), custom('a')] }, { nodes: [custom('a')] }],
    };
    const before = structuredClone(document);
    expect(collectDiagramAssetIds(document)).toEqual(['a', 'b']);
    expect(document).toEqual(before);
    expect(collectDiagramAssetIds({ nodes: [custom('b')] })).toEqual(['b']);
  });
  it('rejects malformed references and expiring URLs in custom node data', () => {
    for (const patch of [
      { assetId: '' },
      { assetId: 'https://evil.invalid/image' },
      { intrinsicWidth: -1 },
      { intrinsicHeight: Infinity },
      { src: 'blob:temporary' },
      { signedUrl: 'https://s3.invalid/' },
    ]) {
      const node = custom('valid');
      Object.assign(node.data, patch);
      expect(() => collectDiagramAssetIds({ nodes: [node] })).toThrow();
    }
  });
  it('bounds custom node counts, including repeated asset IDs', () => {
    expect(() =>
      collectDiagramAssetIds({
        nodes: Array.from({ length: 2001 }, () => custom('same')),
      }),
    ).toThrow('2000');
  });
  it('locks the authenticated user before reading references', async () => {
    const { tx, db } = setup();
    await lockDiagramOwner(db, 'owner');
    expect(tx.$queryRaw.mock.calls[0][1]).toBe('owner');
    tx.$queryRaw.mockResolvedValue([]);
    await expect(lockDiagramOwner(db, 'missing')).rejects.toThrow(
      'Account not found',
    );
  });
  it('only accepts READY assets owned by the authenticated account', async () => {
    const { tx, db } = setup();
    tx.asset.findMany.mockResolvedValue([{ id: 'mine' }]);
    await validateDiagramAssets(db, 'owner', ['mine']);
    expect(tx.asset.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['mine'] }, ownerId: 'owner', status: 'READY' },
      select: { id: true },
    });
    await expect(
      validateDiagramAssets(db, 'owner', ['mine', 'someone-elses']),
    ).rejects.toThrow('unavailable');
  });
  it('synchronizes joins and touches removed references for cleanup grace', async () => {
    const { tx, db } = setup();
    await syncDiagramAssets(db, 'diagram', ['new-image']);
    expect(tx.diagramAsset.createMany).toHaveBeenCalledWith({
      data: [{ diagramId: 'diagram', assetId: 'new-image' }],
      skipDuplicates: true,
    });
    expect(tx.diagramAsset.deleteMany).toHaveBeenCalledWith({
      where: { diagramId: 'diagram', assetId: { notIn: ['new-image'] } },
    });
    expect(tx.asset.updateMany.mock.calls[0][0].where).toEqual({
      id: { in: ['new-image', 'old-image'] },
    });
    expect(tx.asset.updateMany.mock.calls[0][0].data.updatedAt).toBeInstanceOf(
      Date,
    );
  });
  it('empty graphs clear references, without inserting empty records', async () => {
    const { tx, db } = setup();
    await syncDiagramAssets(db, 'diagram', []);
    expect(tx.diagramAsset.createMany).not.toHaveBeenCalled();
    expect(tx.asset.updateMany).toHaveBeenCalled();
  });
});
