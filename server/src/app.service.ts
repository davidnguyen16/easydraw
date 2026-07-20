import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      usersInDb: await this.prisma.user.count(),
    };
  }
}
