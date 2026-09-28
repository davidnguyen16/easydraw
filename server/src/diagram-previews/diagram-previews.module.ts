import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { S3AssetsService } from '../node-library/s3-assets.service';
import { DiagramPreviewsController } from './diagram-previews.controller';
import { DiagramPreviewsService } from './diagram-previews.service';
import { PreviewProviderService } from './preview-provider.service';
import { PreviewOriginGuard } from './preview-origin.guard';
import { PreviewMaintenanceService } from './preview-maintenance.service';
import { PreviewCommitService } from './preview-commit.service';

@Module({
  imports: [PrismaModule],
  controllers: [DiagramPreviewsController],
  providers: [
    DiagramPreviewsService,
    PreviewProviderService,
    S3AssetsService,
    PreviewOriginGuard,
    PreviewMaintenanceService,
    PreviewCommitService,
  ],
})
export class DiagramPreviewsModule {}
