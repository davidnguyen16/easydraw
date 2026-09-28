import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ObjectLibraryController } from './object-library.controller';
import { ObjectLibraryService } from './object-library.service';

@Module({
  imports: [PrismaModule],
  controllers: [ObjectLibraryController],
  providers: [ObjectLibraryService],
})
export class ObjectLibraryModule {}
