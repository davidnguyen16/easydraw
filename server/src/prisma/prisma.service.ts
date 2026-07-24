import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const raw = process.env.DATABASE_URL ?? '';
    const needsSsl = raw.includes('sslmode=');
    const connectionString = raw.replace(/[?&]sslmode=[^&]*/g, '');
    super({
      adapter: new PrismaPg({
        connectionString,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
