import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { DiagramsModule } from './diagrams/diagrams.module';

@Module({
  imports: [PrismaModule, DiagramsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
