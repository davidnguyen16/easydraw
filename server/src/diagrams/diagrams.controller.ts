import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { DiagramsService } from './diagrams.service';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { UpdateDiagramDto } from './dto/update-diagram.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

import { diagramsListCacheKeyFromContext } from './diagrams.cache';

@ApiTags('Diagrams')
@UseGuards(JwtAuthGuard)
@Controller('diagrams')
export class DiagramsController {
  constructor(private readonly diagramsService: DiagramsService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheKey(diagramsListCacheKeyFromContext)
  @CacheTTL(60_000)
  findAll(@CurrentUser() user: JwtPayload) {
    return this.diagramsService.findAll(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateDiagramDto) {
    return this.diagramsService.create(
      user.sub,
      body.title,
      body.type,
      body.data,
    );
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.diagramsService.findOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: UpdateDiagramDto,
  ) {
    return this.diagramsService.update(user.sub, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.diagramsService.remove(user.sub, id);
  }
}
