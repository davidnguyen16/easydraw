import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import {
  MAX_OBJECTS_PER_USER,
  ObjectLibraryService,
} from './object-library.service';

const recipe = {
  version: 2,
  parts: [
    {
      shape: 'box',
      material: 'custom',
      color: '#94a790',
      size: [1, 0.5, 1],
      position: [0, 0, 0],
    },
  ],
};

const SECTION = '6d1c0a4e-7a4b-4a8b-9f0e-2c3d4e5f6a7b';

function setup(count = 0) {
  const customNodeSection = {
    findFirst: jest.fn().mockResolvedValue({ id: SECTION }),
  };
  const customObject3D = {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(count),
    create: jest
      .fn()
      .mockImplementation(({ data }) =>
        Promise.resolve({ id: 'obj', ...data }),
      ),
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest
      .fn()
      .mockImplementation(
        ({ where, data }: { where: { id: string }; data: object }) =>
          Promise.resolve({ id: where.id, ...data }),
      ),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  // Records the order of owner locks and reads, as a database would see them.
  const events: string[] = [];
  const $queryRaw = jest.fn((sql: TemplateStringsArray) => {
    events.push(sql.join('?'));
    return Promise.resolve([]);
  });
  customObject3D.count.mockImplementation(() => {
    events.push('count');
    return Promise.resolve(count);
  });
  const prisma = { customObject3D, customNodeSection, $queryRaw };
  const $transaction = jest.fn((work: (tx: typeof prisma) => unknown) =>
    work(prisma),
  );
  const service = new ObjectLibraryService({
    ...prisma,
    $transaction,
  } as unknown as PrismaService);
  return { service, customObject3D, customNodeSection, events, $transaction };
}

describe('ObjectLibraryService', () => {
  it("files a valid recipe in one of the owner's libraries", async () => {
    const { service, customObject3D, customNodeSection } = setup();
    await service.create('owner', {
      sectionId: SECTION,
      name: 'Planter',
      recipe,
    });
    expect(customNodeSection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SECTION, ownerId: 'owner', deletedAt: null },
      }),
    );
    expect(customObject3D.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { ownerId: 'owner', sectionId: SECTION, name: 'Planter', recipe },
      }),
    );
  });

  it("refuses a library that is not the caller's or was removed", async () => {
    const { service, customObject3D, customNodeSection } = setup();
    customNodeSection.findFirst.mockResolvedValue(null);
    await expect(
      service.create('owner', { sectionId: SECTION, name: 'Planter', recipe }),
    ).rejects.toBeInstanceOf(NotFoundException);
    customObject3D.findFirst.mockResolvedValue({ id: 'obj' });
    await expect(
      service.update('owner', 'obj', { sectionId: SECTION }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(customObject3D.create).not.toHaveBeenCalled();
    expect(customObject3D.update).not.toHaveBeenCalled();
  });

  it('rejects recipes the renderer could not draw', async () => {
    const { service, customObject3D } = setup();
    await expect(
      service.create('owner', {
        sectionId: SECTION,
        name: 'Bad',
        recipe: { version: 2, parts: [{ shape: 'mesh' }] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create('owner', {
        sectionId: SECTION,
        name: 'Bad',
        recipe: { version: 9 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(customObject3D.create).not.toHaveBeenCalled();
  });

  it('caps the catalogue per user', async () => {
    const { service } = setup(MAX_OBJECTS_PER_USER);
    await expect(
      service.create('owner', { sectionId: SECTION, name: 'One more', recipe }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('counts the quota only after locking the owner, inside one transaction', async () => {
    const { service, events, $transaction } = setup();
    await service.create('owner', { sectionId: SECTION, name: 'P', recipe });

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      'SELECT "id" FROM "User" WHERE "id" = ? FOR UPDATE',
      'count',
    ]);
  });

  it('only touches objects the caller owns', async () => {
    const { service, customObject3D } = setup();
    await expect(
      service.update('owner', 'obj', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('owner', 'obj')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(customObject3D.update).not.toHaveBeenCalled();
    expect(customObject3D.deleteMany).toHaveBeenCalledWith({
      where: { id: 'obj', ownerId: 'owner', section: { deletedAt: null } },
    });
    customObject3D.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.remove('owner', 'obj')).resolves.toBeUndefined();
    customObject3D.findFirst.mockResolvedValue({ id: 'obj' });
    await service.update('owner', 'obj', { recipe });
    expect(customObject3D.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { recipe } }),
    );
  });
});
