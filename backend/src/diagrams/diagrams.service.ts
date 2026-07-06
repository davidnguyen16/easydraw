import { Injectable } from '@nestjs/common';
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
}
