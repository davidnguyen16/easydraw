import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { NodeLibraryService } from '../src/node-library/node-library.service';
import {
  MAX_OBJECTS_PER_USER,
  ObjectLibraryService,
} from '../src/object-library/object-library.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Custom 3D library writes race each other (release audit, P2). Concurrency
 * only means something against the real database's locks.
 */
const EMAIL_DOMAIN = '@object-library-e2e.easydraw.test';
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

describe('custom 3D library concurrency (full e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let objects: ObjectLibraryService;
  let libraries: NodeLibraryService;

  async function cleanFixtures() {
    await prisma.user.deleteMany({
      where: { email: { endsWith: EMAIL_DOMAIN } },
    });
  }

  async function ownerWithLibrary(localPart: string) {
    const owner = await prisma.user.create({
      data: { email: `${localPart}${EMAIL_DOMAIN}` },
    });
    const section = await prisma.customNodeSection.create({
      data: { ownerId: owner.id, name: 'Library' },
    });
    return { ownerId: owner.id, sectionId: section.id };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    objects = app.get(ObjectLibraryService);
    libraries = app.get(NodeLibraryService);

    const [database] = await prisma.$queryRaw<
      Array<{ name: string }>
    >`SELECT current_database() AS name`;
    if (database.name !== 'easydraw_test') {
      throw new Error(`Refusing to clean database: ${database.name}`);
    }
    await cleanFixtures();
  });

  afterAll(async () => {
    try {
      if (prisma) await cleanFixtures();
    } finally {
      if (app) await app.close();
    }
  });

  it('never lets concurrent creates overshoot the per-user cap', async () => {
    const { ownerId, sectionId } = await ownerWithLibrary('cap');
    await prisma.customObject3D.createMany({
      data: Array.from({ length: MAX_OBJECTS_PER_USER - 1 }, (_, i) => ({
        ownerId,
        sectionId,
        name: `Existing ${i}`,
        recipe,
      })),
    });
    // Another API task whose request stalls between counting the quota and
    // writing: exactly the window a racing request would slip through.
    const otherTask = new PrismaService();
    await otherTask.$connect();
    const stalled = otherTask.$extends({
      query: {
        customObject3D: {
          async count({ args, query }) {
            const result = await query(args);
            await new Promise((resolve) => setTimeout(resolve, 300));
            return result;
          },
        },
      },
    });
    const slow = new ObjectLibraryService(
      stalled as unknown as PrismaService,
    ).create(ownerId, { sectionId, name: 'Slow', recipe });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const results = await Promise.allSettled([
      slow,
      ...Array.from({ length: 3 }, (_, i) =>
        objects.create(ownerId, { sectionId, name: `Racer ${i}`, recipe }),
      ),
    ]).finally(() => otherTask.$disconnect());

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const result of results.filter((r) => r.status === 'rejected')) {
      expect(result.reason).toBeInstanceOf(BadRequestException);
    }
    expect(await prisma.customObject3D.count({ where: { ownerId } })).toBe(
      MAX_OBJECTS_PER_USER,
    );
  });

  it('never files an object into a library that is being removed', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { ownerId, sectionId } = await ownerWithLibrary(
        `removal-${attempt}`,
      );

      await Promise.allSettled([
        objects.create(ownerId, { sectionId, name: 'Racer', recipe }),
        libraries.deleteSection(ownerId, sectionId),
      ]);

      const section = await prisma.customNodeSection.findUniqueOrThrow({
        where: { id: sectionId },
      });
      expect(section.deletedAt).not.toBeNull();
      expect(await prisma.customObject3D.count({ where: { sectionId } })).toBe(
        0,
      );
    }
  });
});
