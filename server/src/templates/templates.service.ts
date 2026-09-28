import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiagramsService } from '../diagrams/diagrams.service';
import { collectDiagramAssetIds } from '../diagrams/diagram-assets';
import { PublishTemplateDto, UpdateTemplateDto } from './dto/templates.dto';

/** Enough for a curated gallery; stops a script from filling the table. */
export const MAX_TEMPLATES = 100;

const LIST_SELECT = {
  id: true,
  title: true,
  category: true,
  type: true,
  sortOrder: true,
  thumbnailAt: true,
  updatedAt: true,
} satisfies Prisma.DiagramTemplateSelect;

/**
 * Sample diagrams. An admin publishes a snapshot of one of their diagrams;
 * every signed-in account sees the gallery and can take a copy into its own
 * workspace. A template can't reference private library images, because the
 * copy would then point at assets its new owner cannot read.
 */
@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagrams: DiagramsService,
  ) {}

  list() {
    return this.prisma.diagramTemplate.findMany({
      select: LIST_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getThumbnail(id: string) {
    const template = await this.prisma.diagramTemplate.findUnique({
      where: { id },
      select: { thumbnail: true, thumbnailType: true, thumbnailAt: true },
    });
    if (!template) throw new NotFoundException('Sample not found.');
    if (!template.thumbnail || !template.thumbnailType || !template.thumbnailAt)
      return null;
    return {
      bytes: Buffer.from(template.thumbnail),
      type: template.thumbnailType,
      at: template.thumbnailAt,
    };
  }

  /** A fresh, independent diagram in the caller's workspace. */
  async use(userId: string, id: string) {
    const template = await this.prisma.diagramTemplate.findUnique({
      where: { id },
      select: {
        title: true,
        category: true,
        type: true,
        data: true,
        thumbnail: true,
        thumbnailType: true,
      },
    });
    if (!template) throw new NotFoundException('Sample not found.');
    return this.diagrams.create(userId, {
      title: template.title,
      type: template.type,
      category: template.category ?? undefined,
      data: template.data as Prisma.InputJsonValue,
      thumbnail:
        template.thumbnail && template.thumbnailType
          ? {
              bytes: new Uint8Array(template.thumbnail),
              type: template.thumbnailType,
            }
          : null,
    });
  }

  async publish(adminId: string, dto: PublishTemplateDto) {
    const source = await this.prisma.diagram.findFirst({
      where: { id: dto.diagramId, ownerId: adminId },
      select: {
        title: true,
        category: true,
        type: true,
        data: true,
        thumbnail: true,
        thumbnailType: true,
        thumbnailAt: true,
      },
    });
    if (!source) throw new NotFoundException('Diagram not found.');
    if (collectDiagramAssetIds(source.data).length > 0)
      throw new BadRequestException(
        'A sample cannot use private library images; other accounts could not load them.',
      );
    const count = await this.prisma.diagramTemplate.count();
    if (count >= MAX_TEMPLATES)
      throw new BadRequestException(
        `At most ${MAX_TEMPLATES} samples can be published.`,
      );
    const last = await this.prisma.diagramTemplate.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return this.prisma.diagramTemplate.create({
      data: {
        title: dto.title ?? source.title,
        category: dto.category ?? source.category,
        type: source.type,
        data: source.data as Prisma.InputJsonValue,
        thumbnail: source.thumbnail,
        thumbnailType: source.thumbnailType,
        thumbnailAt: source.thumbnailAt,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        publishedById: adminId,
      },
      select: LIST_SELECT,
    });
  }

  async update(id: string, dto: UpdateTemplateDto) {
    await this.require(id);
    return this.prisma.diagramTemplate.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      select: LIST_SELECT,
    });
  }

  async remove(id: string) {
    await this.require(id);
    await this.prisma.diagramTemplate.delete({ where: { id } });
  }

  private async require(id: string) {
    const found = await this.prisma.diagramTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Sample not found.');
  }
}
