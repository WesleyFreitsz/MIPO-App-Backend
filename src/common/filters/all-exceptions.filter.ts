import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const POSTGRES_FOREIGN_KEY_VIOLATION = '23503';
const POSTGRES_INVALID_TEXT_REPRESENTATION = '22P02';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      return super.catch(exception, host);
    }

    if (exception instanceof HttpException) {
      return super.catch(exception, host);
    }

    if (exception instanceof QueryFailedError) {
      const code = (exception.driverError as { code?: string } | undefined)
        ?.code;
      if (code === POSTGRES_UNIQUE_VIOLATION) {
        return super.catch(new ConflictException('Registro duplicado.'), host);
      }
      if (
        code === POSTGRES_FOREIGN_KEY_VIOLATION ||
        code === POSTGRES_INVALID_TEXT_REPRESENTATION
      ) {
        return super.catch(
          new BadRequestException('Referência inválida.'),
          host,
        );
      }
    }

    this.logger.error(
      exception instanceof Error ? exception.message : String(exception),
      exception instanceof Error ? exception.stack : undefined,
    );
    return super.catch(exception, host);
  }
}
