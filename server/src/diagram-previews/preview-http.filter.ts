import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PreviewPipelineError } from './preview-provider.service';

/** Never leak raw DB/provider/storage exceptions or request payloads. */
@Catch()
export class PreviewHttpFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res.setHeader('Cache-Control', 'private, no-store');
    if (error instanceof HttpException) {
      const body = error.getResponse();
      res
        .status(error.getStatus())
        .json(typeof body === 'string' ? { message: body } : body);
      return;
    }
    if (error instanceof PreviewPipelineError) {
      res.status(503).json({ code: error.code, message: error.message });
      return;
    }
    res.status(503).json({
      code: 'preview_unavailable',
      message:
        'AI preview is unavailable. Check the server configuration and preview migration.',
    });
  }
}
