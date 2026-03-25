import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: Record<string, unknown> | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const typedResponse = exceptionResponse as Record<string, unknown>;
      message = String(typedResponse.message ?? message);
      code = String(typedResponse.code ?? this.mapStatusToCode(status));
      details = typedResponse.details as Record<string, unknown> | undefined;
    } else if (exception instanceof Error) {
      message = exception.message;
      code = this.mapStatusToCode(status);
    }

    response.status(status).json({
      error: {
        code,
        message,
        details: {
          ...(details ?? {}),
          path: request.url,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  private mapStatusToCode(status: number) {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
