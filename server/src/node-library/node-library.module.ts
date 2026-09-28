import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NodeLibraryController } from './node-library.controller';
import { NodeLibraryService } from './node-library.service';
import { S3AssetsService } from './s3-assets.service';

@Module({
  imports: [PrismaModule],
  controllers: [NodeLibraryController],
  providers: [NodeLibraryService, S3AssetsService],
})
export class NodeLibraryModule {}
