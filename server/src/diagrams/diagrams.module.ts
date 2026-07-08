import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DiagramsController } from './diagrams.controller';
import { DiagramsService } from './diagrams.service';

@Module({
  imports: [PrismaModule],
  controllers: [DiagramsController],
  providers: [DiagramsService]
})
export class DiagramsModule {}
