import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// TODO(auth): Replace with this id during authentication process
const DEV_USER_ID = 'c5f066f7-0c57-4445-a2f8-ecfced6b9e67';

@Injectable()
export class DiagramsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.diagram.findMany({
      where: { ownerId: DEV_USER_ID },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(title: string, data: any) {
    return this.prisma.diagram.create({
      data: {
        title,
        data: data ?? {}, 
        ownerId: DEV_USER_ID,
      },
    });
  }

  async findOne(id: string) {
    const diagram = await this.prisma.diagram.findFirst({
      where: { id, ownerId: DEV_USER_ID },
    });
    if (!diagram) {
      throw new NotFoundException(`Diagram with id ${id} not found`);
    }
    return diagram;
  }

  async update(id: string, patch: { title?: string; data?: any }) {
    await this.findOne(id);
    return this.prisma.diagram.update({
      where: { id },
      data: patch,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.diagram.delete({ where: { id } });
    return { message: `Diagram with id ${id} deleted successfully` };
  }
}
