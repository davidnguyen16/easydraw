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
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthUser } from '../auth/session-auth.guard';
import { CreateObject3DDto, UpdateObject3DDto } from './dto/object-library.dto';
import { ObjectLibraryService } from './object-library.service';

@ApiTags('Custom 3D objects')
@UseGuards(SessionAuthGuard)
@Controller('object-library')
export class ObjectLibraryController {
  constructor(private readonly objects: ObjectLibraryService) {}

  @Get('objects')
  list(@CurrentUser() user: AuthUser) {
    return this.objects.list(user.sub);
  }

  @Post('objects')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateObject3DDto) {
    return this.objects.create(user.sub, dto);
  }

  @Patch('objects/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateObject3DDto,
  ) {
    return this.objects.update(user.sub, id, dto);
  }

  @Delete('objects/:id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.objects.remove(user.sub, id);
  }
}
