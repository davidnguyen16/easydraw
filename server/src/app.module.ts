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
import { LoggerModule } from 'nestjs-pino';
import { NodeLibraryModule } from './node-library/node-library.module';
import { ObjectLibraryModule } from './object-library/object-library.module';
import { TemplatesModule } from './templates/templates.module';
import { DiagramPreviewsModule } from './diagram-previews/diagram-previews.module';
import { TrustedOriginGuard } from './auth/trusted-origin.guard';

@Module({
  imports: [
    // Global rate-limit baseline: max 100 requests per IP per 60s. Generous
    // enough for autosave; sensitive routes (login) tighten this per-route.
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production' &&
          process.env.NODE_ENV !== 'test'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        level: process.env.LOG_LEVEL ?? 'info',
        serializers: {
          // Log the route, but never its query string. OAuth callbacks can
          // contain short-lived authorisation codes in the URL.
          req: (req: { method?: string; url?: string }) => ({
            method: req.method,
            url: req.url?.split('?')[0],
          }),
          res: (res: { statusCode?: number }) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
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
          process.env.REDIS_URL
            ? createKeyv(process.env.REDIS_URL)
            : new Keyv(),
        ],
      }),
    }),
    PrismaModule,
    DiagramsModule,
    AuthModule,
    NodeLibraryModule,
    ObjectLibraryModule,
    TemplatesModule,
    DiagramPreviewsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: TrustedOriginGuard },
  ],
})
export class AppModule {}
