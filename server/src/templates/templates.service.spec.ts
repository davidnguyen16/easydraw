import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { DiagramsService } from '../diagrams/diagrams.service';
import { TemplatesService } from './templates.service';

// jest's asymmetric matchers are typed any; name them once so the assertions stay lint-clean.
const containing = (shape: object): unknown => expect.objectContaining(shape);

const SAMPLE = {
  title: 'Office',
  category: 'Office',
  type: 'diagram',
  data: { pages: [{ nodes: [] }] },
  thumbnail: new Uint8Array([1, 2, 3]),
  thumbnailType: 'image/webp',
  thumbnailAt: new Date('2026-09-21T00:00:00Z'),
};

function setup() {
  const diagramTemplate = {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(SAMPLE),
    findFirst: jest.fn().mockResolvedValue({ sortOrder: 4 }),
    count: jest.fn().mockResolvedValue(0),
    create: jest
      .fn()
      .mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ id: 'tpl', ...data }),
      ),
    update: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const diagram = { findFirst: jest.fn().mockResolvedValue(SAMPLE) };
  const diagrams = {
    create: jest
      .fn()
      .mockImplementation((_userId: string, input: object) =>
        Promise.resolve({ id: 'copy', ...input }),
      ),
  };
  const service = new TemplatesService(
    { diagramTemplate, diagram } as unknown as PrismaService,
    diagrams as unknown as DiagramsService,
  );
  return { service, diagramTemplate, diagram, diagrams };
}

describe('TemplatesService', () => {
  it('publishes a snapshot of the admin’s own diagram at the end of the gallery', async () => {
    const { service, diagramTemplate } = setup();
    await service.publish('admin', {
      diagramId: '6d1c0a4e-7a4b-4a8b-9f0e-2c3d4e5f6a7b',
    });
    expect(diagramTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: containing({
          title: 'Office',
          category: 'Office',
          type: 'diagram',
          thumbnailType: 'image/webp',
          sortOrder: 5,
          publishedById: 'admin',
        }),
      }),
    );
  });

  it('refuses diagrams that are not the admin’s or that use private images', async () => {
    const { service, diagram, diagramTemplate } = setup();
    diagram.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.publish('admin', {
        diagramId: '6d1c0a4e-7a4b-4a8b-9f0e-2c3d4e5f6a7b',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    diagram.findFirst.mockResolvedValueOnce({
      ...SAMPLE,
      data: {
        pages: [
          {
            nodes: [{ type: 'CustomImageNode', data: { assetId: 'asset-1' } }],
          },
        ],
      },
    });
    await expect(
      service.publish('admin', {
        diagramId: '6d1c0a4e-7a4b-4a8b-9f0e-2c3d4e5f6a7b',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(diagramTemplate.create).not.toHaveBeenCalled();
  });

  it('gives a user an independent copy with the thumbnail', async () => {
    const { service, diagrams } = setup();
    const copy = await service.use('user', 'tpl');
    expect(copy).toEqual(
      expect.objectContaining({
        id: 'copy',
        title: 'Office',
        category: 'Office',
      }),
    );
    expect(diagrams.create).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({
        type: 'diagram',
        thumbnail: containing({ type: 'image/webp' }),
      }),
    );
  });
});
