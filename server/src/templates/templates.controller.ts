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
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthUser } from '../auth/session-auth.guard';
import { thumbnailHeaders } from '../diagrams/thumbnail';
import { PublishTemplateDto, UpdateTemplateDto } from './dto/templates.dto';
import { TemplatesService } from './templates.service';

@ApiTags('Sample diagrams')
@UseGuards(SessionAuthGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list() {
    return this.templates.list();
  }

  @Get(':id/thumbnail')
  @SkipThrottle()
  async thumbnail(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const image = await this.templates.getThumbnail(id);
    if (!image) {
      res.status(404).json({ message: 'No thumbnail' });
      return;
    }
    res.set(thumbnailHeaders(image.type, image.at)).send(image.bytes);
  }

  @Post(':id/use')
  use(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.templates.use(user.sub, id);
  }

  @Post()
  @UseGuards(AdminGuard)
  publish(@CurrentUser() user: AuthUser, @Body() dto: PublishTemplateDto) {
    return this.templates.publish(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templates.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.remove(id);
  }
}
