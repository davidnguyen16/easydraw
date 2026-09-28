import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthUser } from '../auth/session-auth.guard';
import {
  CreateSectionDto,
  CreateUploadDto,
  ResolveAssetsDto,
  UpdateNodeDto,
  UpdateSectionDto,
} from './dto/node-library.dto';
import { NodeLibraryService } from './node-library.service';

@ApiTags('Custom node library')
@UseGuards(SessionAuthGuard)
@Controller('node-library')
export class NodeLibraryController {
  constructor(private readonly library: NodeLibraryService) {}

  @Get('sections')
  list(@CurrentUser() user: AuthUser) {
    return this.library.listSections(user.sub);
  }

  @Post('sections')
  createSection(@CurrentUser() user: AuthUser, @Body() dto: CreateSectionDto) {
    return this.library.createSection(user.sub, dto.name);
  }

  @Patch('sections/:id')
  updateSection(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.library.updateSection(user.sub, id, dto);
  }

  @Delete('sections/:id')
  deleteSection(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.library.deleteSection(user.sub, id);
  }

  @Patch('nodes/:id')
  updateNode(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNodeDto,
  ) {
    return this.library.updateNode(user.sub, id, dto);
  }

  @Delete('nodes/:id')
  deleteNode(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.library.deleteNode(user.sub, id);
  }

  @Post('sections/:id/uploads')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateUploadDto,
  ) {
    return this.library.createUpload(user.sub, id, dto);
  }

  @Post('uploads/:id/complete')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.library.completeUpload(user.sub, id);
  }

  @Post('assets/resolve')
  resolve(@CurrentUser() user: AuthUser, @Body() dto: ResolveAssetsDto) {
    return this.library.resolveAssets(user.sub, dto.assetIds, dto.variant);
  }
}
