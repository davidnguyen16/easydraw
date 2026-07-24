import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { diagramListCacheKey } from './diagrams.cache';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DiagramsService {
  private readonly logger = new Logger(DiagramsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  private async invalidateListCache(userId: string): Promise<void> {
    try {
      await this.cacheManager.del(diagramListCacheKey(userId));
    } catch (error) {
      this.logger.warn(
        'Failed to invalidate diagrams list cache',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  findAll(userId: string) {
    return this.prisma.diagram.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(userId: string, title: string, type: string, data: any) {
    const diagram = await this.prisma.diagram.create({
      data: {
        title,
        type,
        data: data ?? {},
        ownerId: userId,
      },
    });

    await this.invalidateListCache(userId);

    return diagram;
  }

  async findOne(userId: string, id: string) {
    const diagram = await this.prisma.diagram.findFirst({
      where: { id, ownerId: userId },
    });
    if (!diagram) {
      throw new NotFoundException(`Diagram with id ${id} not found`);
    }
    return diagram;
  }

  async update(
    userId: string,
    id: string,
    patch: { title?: string; status?: string; data?: any },
  ) {
    await this.findOne(userId, id);

    const diagram = await this.prisma.diagram.update({
      where: { id },
      data: patch,
    });

    await this.invalidateListCache(userId);

    return diagram;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.diagram.delete({ where: { id } });

    await this.invalidateListCache(userId);

    return {
      message: `Diagram with id ${id} deleted successfully`,
    };
  }
}
