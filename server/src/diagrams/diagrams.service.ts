import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DiagramsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.diagram.findMany({
      where: { ownerId: userId },
      select: { 
        id: true, 
        title: true, 
        type: true, 
        status: true,
        createdAt: true, 
        updatedAt: true 
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(userId: string, title: string, type: string, data: any) {
    return this.prisma.diagram.create({
      data: {
        title,
        type,
        data: data ?? {}, 
        ownerId: userId,
      },
    });
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

  async update(userId: string, id: string, patch: { title?: string; status?: string; data?: any }) {
    await this.findOne(userId, id);
    return this.prisma.diagram.update({
      where: { id },
      data: patch,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.diagram.delete({ where: { id } });
    return { message: `Diagram with id ${id} deleted successfully` };
  }
}
