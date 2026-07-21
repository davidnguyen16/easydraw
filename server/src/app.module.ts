import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { DiagramsModule } from './diagrams/diagrams.module';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { Keyv } from 'keyv';

@Module({
  imports: [
    // Global rate-limit baseline: max 100 requests per IP per 60s. Generous
    // enough for autosave; sensitive routes (login) tighten this per-route.
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        stores: [
          process.env.REDIS_URL ? createKeyv(process.env.REDIS_URL) : new Keyv(),
        ],
      }),
    }),
    PrismaModule, 
    DiagramsModule, 
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
