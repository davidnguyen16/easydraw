import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard, type AuthUser } from '../auth/session-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreatePreviewDto } from './create-preview.dto';
import { DiagramPreviewsService } from './diagram-previews.service';
import { PreviewOriginGuard } from './preview-origin.guard';
import { PreviewHttpFilter } from './preview-http.filter';
import { CommitPreviewDto } from './commit-preview.dto';
import { PreviewCommitService } from './preview-commit.service';

@Controller()
@UseGuards(SessionAuthGuard, PreviewOriginGuard)
@UseFilters(PreviewHttpFilter)
export class DiagramPreviewsController {
  constructor(
    private readonly previews: DiagramPreviewsService,
    private readonly commits: PreviewCommitService,
  ) {}

  @Post('diagram-previews/:id/commit')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  commit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CommitPreviewDto,
  ) {
    return this.commits.commit(user.sub, id, input);
  }

  @Post('diagrams/:id/previews')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  generate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreatePreviewDto,
  ) {
    // The attempt is durable before work starts. This request waits for it;
    // reconnecting clients recover it via GET, never an automatic paid retry.
    return this.previews.generate(user.sub, id, input);
  }

  @Get('diagrams/:id/previews/requests/:requestId')
  @Header('Cache-Control', 'private, no-store')
  request(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
  ) {
    return this.previews.findRequest(user.sub, id, requestId);
  }

  @Delete('diagrams/:id/previews/requests/:requestId')
  @HttpCode(204)
  @Header('Cache-Control', 'private, no-store')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', new ParseUUIDPipe({ version: '4' })) requestId: string,
  ) {
    return this.previews.cancelRequest(user.sub, id, requestId);
  }

  @Get('diagram-previews/:id')
  @Header('Cache-Control', 'private, no-store')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.previews.get(user.sub, id);
  }

  @Get('diagram-previews/:id/source')
  @Header('Cache-Control', 'private, no-store')
  source(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.previews.sourceUrl(user.sub, id);
  }
}
