/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Jest mock call inspection and asymmetric matchers. */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import sharp from 'sharp';
import type { PrismaService } from '../prisma/prisma.service';
import { NodeLibraryService } from './node-library.service';
import { InvalidUploadedFileError, S3AssetsService } from './s3-assets.service';

function setup() {
  const section = {
    id: 'section',
    ownerId: 'owner',
    name: 'Factory',
    deletedAt: null,
  };
  const node = {
    id: 'node',
    sectionId: section.id,
    assetId: 'asset',
    name: 'Robot',
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    asset: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { byteSize: 0, storedBytes: 0 } }),
      create: jest.fn().mockResolvedValue({ id: 'asset' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    customNodeSection: {
      findFirst: jest.fn().mockResolvedValue(section),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(section),
      update: jest.fn().mockResolvedValue(section),
    },
    customNodeDefinition: {
      findFirst: jest.fn().mockResolvedValue(node),
      update: jest.fn().mockResolvedValue(node),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(node),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    customObject3D: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const storage = {
    requireConfiguration: jest.fn(),
    createUpload: jest.fn().mockResolvedValue({
      url: 'https://bucket.s3.amazonaws.com',
      fields: { key: 'pending/key' },
    }),
    readUpload: jest.fn(),
    putImage: jest.fn().mockResolvedValue(undefined),
    deletePendingOrUnpublished: jest.fn().mockResolvedValue(undefined),
    signRead: jest.fn().mockResolvedValue('https://signed.example/image'),
  };
  const service = new NodeLibraryService(
    prisma as unknown as PrismaService,
    storage as unknown as S3AssetsService,
  );
  return { service, prisma, tx, storage, node };
}

const upload = {
  fileName: 'robot.png',
  contentType: 'image/png',
  byteSize: 100,
};
const pendingAsset = {
  id: 'asset',
  ownerId: 'owner',
  status: 'PENDING',
  createdAt: new Date(),
  updatedAt: new Date(),
  uploadKey: 'pending/owner/asset/random',
  unpublishedKeys: [],
  originalMimeType: 'image/png',
  byteSize: 100,
};

describe('NodeLibraryService', () => {
  afterEach(() => {
    delete process.env.ASSET_USER_QUOTA_BYTES;
    delete process.env.ASSET_MAX_FILE_BYTES;
  });

  it('filters library lists by owner, active sections and READY assets', async () => {
    const { service, tx } = setup();
    await expect(service.listSections('owner')).resolves.toEqual({
      sections: [],
    });
    expect(tx.customNodeSection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'owner', deletedAt: null } }),
    );
    const query = tx.customNodeSection.findMany.mock.calls[0][0];
    expect(query.select.nodes.where.asset.status).toBe('READY');
  });

  it('reserves quota under a user row lock before issuing an exact-size S3 form', async () => {
    const { service, tx, storage } = setup();
    const result = await service.createUpload('owner', 'section', upload);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.asset.aggregate.mock.invocationCallOrder[0],
    );
    expect(tx.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: 'owner',
          status: 'PENDING',
          byteSize: 100,
        }),
      }),
    );
    expect(storage.createUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^pending\/owner\//),
      'image/png',
      100,
    );
    expect(result.assetId).toMatch(/^[\da-f-]{36}$/);
  });

  it('rejects uploads into another account section or built-in category', async () => {
    const { service, tx, storage } = setup();
    tx.customNodeSection.findFirst.mockResolvedValue(null);
    await expect(
      service.createUpload('owner', 'basic', upload),
    ).rejects.toThrow(NotFoundException);
    expect(tx.customNodeSection.findFirst).toHaveBeenCalledWith({
      where: { id: 'basic', ownerId: 'owner', deletedAt: null },
    });
    expect(storage.createUpload).not.toHaveBeenCalled();
  });

  it('counts simultaneous pending reservations against the quota', async () => {
    process.env.ASSET_USER_QUOTA_BYTES = '150';
    const { service, tx, storage } = setup();
    tx.asset.aggregate.mockResolvedValue({
      _sum: { byteSize: 100, storedBytes: 0 },
    });
    await expect(
      service.createUpload('owner', 'section', upload),
    ).rejects.toThrow(/quota/);
    expect(storage.createUpload).not.toHaveBeenCalled();
    expect(tx.asset.create).not.toHaveBeenCalled();
  });

  it('rejects MIME/filename mismatch and excessive size before S3 signing', async () => {
    const { service, storage } = setup();
    await expect(
      service.createUpload('owner', 'section', {
        ...upload,
        fileName: 'script.html',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.createUpload('owner', 'section', {
        ...upload,
        byteSize: 100 * 1024 * 1024,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(storage.createUpload).not.toHaveBeenCalled();
  });

  it('releases a reservation if AWS signing fails', async () => {
    const { service, storage, tx } = setup();
    storage.createUpload.mockRejectedValue(
      new Error('AWS secret must not be exposed'),
    );
    await expect(
      service.createUpload('owner', 'section', upload),
    ).rejects.toThrow('S3 upload signing failed');
    expect(tx.asset.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { status: 'REJECTED' } }),
    );
  });

  it('never resolves foreign or non-READY assets, even if their IDs are known', async () => {
    const { service, tx, storage } = setup();
    tx.asset.findMany.mockResolvedValue([]);
    await expect(service.resolveAssets('owner', ['foreign'])).resolves.toEqual({
      assets: [],
    });
    expect(tx.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['foreign'] }, ownerId: 'owner', status: 'READY' },
      }),
    );
    expect(storage.signRead).not.toHaveBeenCalled();
  });

  it('allows owned READY assets from archived libraries to keep diagrams intact', async () => {
    const { service, tx, storage } = setup();
    tx.asset.findMany.mockResolvedValue([
      {
        id: 'asset',
        s3Key: 'assets/immutable/image.png',
        thumbnailKey: 'assets/immutable/thumb.png',
      },
    ]);
    const result = await service.resolveAssets('owner', ['asset'], 'thumbnail');
    expect(result.assets[0]).toEqual(
      expect.objectContaining({
        id: 'asset',
        url: 'https://signed.example/image',
      }),
    );
    expect(storage.signRead).toHaveBeenCalledWith('assets/immutable/thumb.png');
  });

  it('soft deletes a section and definitions without deleting S3 assets', async () => {
    const { service, tx, storage } = setup();
    await expect(service.deleteSection('owner', 'section')).resolves.toEqual({
      deleted: true,
    });
    expect(tx.customNodeDefinition.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sectionId: 'section', deletedAt: null },
      }),
    );
    expect(tx.customObject3D.deleteMany).toHaveBeenCalledWith({
      where: { sectionId: 'section' },
    });
    expect(storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
  });

  it('requires ownership of both source node and destination section for a move', async () => {
    const { service, tx } = setup();
    tx.customNodeSection.findFirst.mockResolvedValue(null);
    await expect(
      service.updateNode('owner', 'node', { sectionId: 'foreign' }),
    ).rejects.toThrow(NotFoundException);
    expect(tx.customNodeDefinition.update).not.toHaveBeenCalled();
  });

  it('finalization is idempotent for a READY asset', async () => {
    const { service, tx, storage, node } = setup();
    tx.asset.findFirst.mockResolvedValue({ ...pendingAsset, status: 'READY' });
    await expect(service.completeUpload('owner', 'asset')).resolves.toEqual(
      node,
    );
    expect(storage.readUpload).not.toHaveBeenCalled();
  });

  it('claims once and publishes validated immutable image keys instead of upload keys', async () => {
    const { service, tx, storage, node } = setup();
    const image = await sharp({
      create: { width: 30, height: 15, channels: 4, background: '#f00' },
    })
      .png()
      .toBuffer();
    tx.asset.findFirst.mockResolvedValue({
      ...pendingAsset,
      byteSize: image.length,
    });
    storage.readUpload.mockResolvedValue(image);
    await expect(service.completeUpload('owner', 'asset')).resolves.toEqual(
      node,
    );
    expect(storage.putImage).toHaveBeenCalledTimes(2);
    expect(storage.putImage.mock.calls[0][0]).toMatch(
      /^assets\/owner\/asset\/[^/]+\/image\.png$/,
    );
    expect(tx.asset.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PROCESSING',
          updatedAt: expect.any(Date),
        }),
        data: expect.objectContaining({
          status: 'READY',
          width: 30,
          height: 15,
          storedBytes: expect.any(Number),
        }),
      }),
    );
    expect(storage.deletePendingOrUnpublished).toHaveBeenCalledWith(
      pendingAsset.uploadKey,
    );
  });

  it('rejects malicious input without publishing a file and fences rejection by lease', async () => {
    const { service, tx, storage } = setup();
    tx.asset.findFirst.mockResolvedValue(pendingAsset);
    storage.readUpload.mockRejectedValue(
      new InvalidUploadedFileError('invalid contents'),
    );
    await expect(service.completeUpload('owner', 'asset')).rejects.toThrow(
      BadRequestException,
    );
    expect(storage.putImage).not.toHaveBeenCalled();
    expect(tx.asset.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: 'owner',
          status: 'PROCESSING',
          updatedAt: expect.any(Date),
        }),
        data: { status: 'REJECTED' },
      }),
    );
  });

  it('durably journals both attempt keys before PUT, retaining them across a publication/database crash', async () => {
    const { service, prisma, tx, storage } = setup();
    const input = await sharp({
      create: { width: 2, height: 2, channels: 4, background: '#f00' },
    })
      .png()
      .toBuffer();
    tx.asset.findFirst.mockResolvedValue({
      ...pendingAsset,
      byteSize: input.length,
    });
    storage.readUpload.mockResolvedValue(input);
    prisma.$transaction
      .mockImplementationOnce((callback) => callback(tx))
      .mockImplementationOnce(() =>
        Promise.reject(new Error('Database lost after successful S3 PUTs')),
      );
    tx.asset.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(
        new Error('Database offline during lease release'),
      );
    await expect(service.completeUpload('owner', 'asset')).rejects.toThrow(
      'Database offline',
    );
    const journal = tx.asset.updateMany.mock.calls[1][0].data.unpublishedKeys
      .push as string[];
    expect(journal).toHaveLength(2);
    expect(storage.putImage).toHaveBeenNthCalledWith(
      1,
      journal[0],
      expect.any(Buffer),
    );
    expect(storage.putImage).toHaveBeenNthCalledWith(
      2,
      journal[1],
      expect.any(Buffer),
    );
    expect(tx.asset.updateMany.mock.invocationCallOrder[1]).toBeLessThan(
      storage.putImage.mock.invocationCallOrder[0],
    );
    expect(storage.deletePendingOrUnpublished).not.toHaveBeenCalled();
  });

  it('publication removes only its final pair and retains previous failed attempts', async () => {
    const { service, tx, storage } = setup();
    const previous = 'assets/owner/asset/previous/image.png';
    const input = await sharp({
      create: { width: 2, height: 2, channels: 4, background: '#f00' },
    })
      .png()
      .toBuffer();
    const stored = {
      ...pendingAsset,
      byteSize: input.length,
      unpublishedKeys: [previous],
    };
    tx.asset.findFirst.mockImplementation(() => Promise.resolve({ ...stored }));
    tx.asset.updateMany.mockImplementation(
      (query: {
        data: { unpublishedKeys?: string[] | { push: string[] } };
      }) => {
        const keys = query.data.unpublishedKeys;
        if (Array.isArray(keys)) stored.unpublishedKeys = [...keys];
        else if (keys) stored.unpublishedKeys.push(...keys.push);
        return Promise.resolve({ count: 1 });
      },
    );
    storage.readUpload.mockResolvedValue(input);
    await service.completeUpload('owner', 'asset');
    expect(stored.unpublishedKeys).toEqual([previous]);
    expect(tx.asset.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'READY',
          unpublishedKeys: [previous],
        }),
      }),
    );
  });

  it('bounds the durable attempt journal and performs no PUT once it is full', async () => {
    const { service, tx, storage } = setup();
    const input = await sharp({
      create: { width: 2, height: 2, channels: 4, background: '#f00' },
    })
      .png()
      .toBuffer();
    tx.asset.findFirst.mockResolvedValue({
      ...pendingAsset,
      byteSize: input.length,
      unpublishedKeys: Array.from(
        { length: 32 },
        (_, index) => `assets/owner/asset/attempt-${index}/image.png`,
      ),
    });
    storage.readUpload.mockResolvedValue(input);
    await expect(service.completeUpload('owner', 'asset')).rejects.toThrow(
      /Too many incomplete upload attempts/,
    );
    expect(storage.putImage).not.toHaveBeenCalled();
  });

  it('does not steal another active finalization claim', async () => {
    const { service, tx, storage } = setup();
    tx.asset.findFirst.mockResolvedValue(pendingAsset);
    tx.asset.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.completeUpload('owner', 'asset')).rejects.toThrow(
      ConflictException,
    );
    expect(storage.readUpload).not.toHaveBeenCalled();
    expect(tx.asset.updateMany).toHaveBeenCalledTimes(1);
  });

  it('bounds decoder concurrency and allows retry after the current upload', async () => {
    const { service, tx, storage } = setup();
    tx.asset.findFirst.mockResolvedValue(pendingAsset);
    let rejectRead!: (error: Error) => void;
    storage.readUpload.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRead = reject;
        }),
    );
    const first = service.completeUpload('owner', 'asset');
    await new Promise((resolve) => setImmediate(resolve));
    await expect(service.completeUpload('owner', 'asset')).rejects.toThrow(
      ServiceUnavailableException,
    );
    rejectRead(new InvalidUploadedFileError('bad file'));
    await expect(first).rejects.toThrow(BadRequestException);
  });
});
