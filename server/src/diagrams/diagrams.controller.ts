import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { DiagramsService } from './diagrams.service';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { UpdateDiagramDto } from './dto/update-diagram.dto';
import { ThumbnailDto } from './dto/thumbnail.dto';
import { parseThumbnail, thumbnailHeaders } from './thumbnail';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/session-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

import { diagramsListCacheKeyFromContext } from './diagrams.cache';

@ApiTags('Diagrams')
@UseGuards(SessionAuthGuard)
@Controller('diagrams')
export class DiagramsController {
  constructor(private readonly diagramsService: DiagramsService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey(diagramsListCacheKeyFromContext)
  @CacheTTL(60_000)
  findAll(@CurrentUser() user: AuthUser) {
    return this.diagramsService.findAll(user.sub);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateDiagramDto) {
    return this.diagramsService.create(user.sub, body);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.diagramsService.findOne(user.sub, id);
  }

  /** A dashboard shows one request per card; the images are tiny and browser-cached by version. */
  @Get(':id/thumbnail')
  @SkipThrottle()
  async thumbnail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const image = await this.diagramsService.getThumbnail(user.sub, id);
    if (!image) {
      res.status(404).json({ message: 'No thumbnail yet' });
      return;
    }
    res.set(thumbnailHeaders(image.type, image.at)).send(image.bytes);
  }

  // Writes keep the default limit: the editor sends at most one per ~2.5 s
  // after a save and treats a refusal as harmless, so only abuse is capped.
  @Patch(':id/thumbnail')
  setThumbnail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ThumbnailDto,
  ) {
    return this.diagramsService.setThumbnail(
      user.sub,
      id,
      parseThumbnail(body.image),
    );
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateDiagramDto,
  ) {
    return this.diagramsService.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.diagramsService.remove(user.sub, id);
  }
}
