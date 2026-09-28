import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  // A diagram document is one JSON body: whiteboards carry a PNG, 3D scenes
  // carry every object's part list. Express's default 100 kB is far too small.
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });

  app.use(helmet());
  app.use(cookieParser());

  // Behind a load balancer the socket address is the balancer's. Trust one hop
  // of X-Forwarded-For so a session records the device's address and the rate
  // limiter counts per caller. Only in production: with no proxy in front, any
  // client could set that header and claim to be someone else.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.enableCors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('EasyDraw API')
      .setDescription('Auth + Diagrams REST API')
      .setVersion('1.0')
      .addCookieAuth('session')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  // ECS stops a task with SIGTERM. As PID 1 in the container, Node ignores it
  // unless something listens; this closes the server and database pool
  // instead of waiting to be killed mid-request.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
