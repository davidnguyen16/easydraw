import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { validateVisual3DRecipe } from '@easydraw/diagram-schema';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateObject3DDto, UpdateObject3DDto } from './dto/object-library.dto';

/** Enough for a personal catalogue; stops a runaway client from filling the table. */
export const MAX_OBJECTS_PER_USER = 200;

const SELECT = {
  id: true,
  sectionId: true,
  name: true,
  recipe: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomObject3DSelect;

/**
 * Private 3D object templates: recipes a user designed and wants to reuse.
 * They are filed in the same private libraries as image nodes
 * (CustomNodeSection), so a library is renamed, reordered or removed once for
 * both. The recipe JSON is validated with the same schema the renderer
 * trusts, so a stored template can always be drawn.
 */
@Injectable()
export class ObjectLibraryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Objects in libraries the owner has removed stay hidden until purged. */
  list(ownerId: string) {
    return this.prisma.customObject3D.findMany({
      where: { ownerId, section: { deletedAt: null } },
      select: SELECT,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * The quota and the live-library check hold until the object is written:
   * the owner row is locked first, as every library writer (including
   * removing a library) does, so concurrent creates cannot overshoot the cap
   * or land in a library that is being removed.
   */
  async create(ownerId: string, dto: CreateObject3DDto) {
    const recipe = this.checkRecipe(dto.recipe);
    return this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, ownerId);
      await this.requireSection(tx, ownerId, dto.sectionId);
      const count = await tx.customObject3D.count({
        where: { ownerId, section: { deletedAt: null } },
      });
      if (count >= MAX_OBJECTS_PER_USER) {
        throw new BadRequestException(
          `You can keep up to ${MAX_OBJECTS_PER_USER} 3D objects.`,
        );
      }
      return tx.customObject3D.create({
        data: { ownerId, sectionId: dto.sectionId, name: dto.name, recipe },
        select: SELECT,
      });
    });
  }

  async update(ownerId: string, id: string, dto: UpdateObject3DDto) {
    const recipe =
      dto.recipe !== undefined ? this.checkRecipe(dto.recipe) : undefined;
    return this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, ownerId);
      await this.own(tx, ownerId, id);
      if (dto.sectionId !== undefined)
        await this.requireSection(tx, ownerId, dto.sectionId);
      return tx.customObject3D.update({
        where: { id },
        data: {
          ...(dto.sectionId !== undefined ? { sectionId: dto.sectionId } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(recipe !== undefined ? { recipe } : {}),
        },
        select: SELECT,
      });
    });
  }

  /** One conditional statement: a concurrent library removal cannot turn it into a 500. */
  async remove(ownerId: string, id: string) {
    const { count } = await this.prisma.customObject3D.deleteMany({
      where: { id, ownerId, section: { deletedAt: null } },
    });
    if (!count) throw new NotFoundException('3D object not found.');
  }

  private async lockOwner(tx: Prisma.TransactionClient, ownerId: string) {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${ownerId} FOR UPDATE`;
  }

  private async own(tx: Prisma.TransactionClient, ownerId: string, id: string) {
    const found = await tx.customObject3D.findFirst({
      where: { id, ownerId, section: { deletedAt: null } },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('3D object not found.');
  }

  /** Same rule as the node library: the library must be the caller's and live. */
  private async requireSection(
    tx: Prisma.TransactionClient,
    ownerId: string,
    sectionId: string,
  ) {
    const section = await tx.customNodeSection.findFirst({
      where: { id: sectionId, ownerId, deletedAt: null },
      select: { id: true },
    });
    if (!section)
      throw new NotFoundException('Custom library section not found.');
  }

  private checkRecipe(recipe: unknown): Prisma.InputJsonObject {
    const result = validateVisual3DRecipe(recipe);
    if (!result.valid) {
      throw new BadRequestException(
        `Invalid 3D recipe: ${result.issues.map((issue) => issue.message).join(' ')}`,
      );
    }
    return recipe as Prisma.InputJsonObject;
  }
}
