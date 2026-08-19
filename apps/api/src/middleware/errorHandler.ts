import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { DomainError } from '../domain/index.js';
import { logger } from '../config/logger.js';
import { ApiError } from '@ai-inbox/contracts';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? 'unknown';

  if (err instanceof DomainError) {
    logger.warn({ event: 'domain_error', requestId, code: err.code, message: err.message });
    const body: ApiError = {
      code: err.code,
      message: err.message,
      details: err.details,
      requestId,
    };
    res.status(err.statusCode).json(body);
    return;
  }

  const isZodError = err instanceof ZodError || (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'ZodError');

  if (isZodError) {
    const zodErr = err as ZodError;
    const details: Record<string, string[]> = {};
    if (Array.isArray(zodErr.issues)) {
      for (const issue of zodErr.issues) {
        const key = issue.path.join('.') || 'root';
        details[key] = [...(details[key] ?? []), issue.message];
      }
    }
    logger.warn({ event: 'validation_error', requestId, details });
    const body: ApiError = { code: 'VALIDATION_ERROR', message: 'Request validation failed', details, requestId };
    res.status(422).json(body);
    return;
  }

  logger.error({ event: 'unexpected_error', requestId, err });
  const body: ApiError = {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again.',
    requestId,
  };
  res.status(500).json(body);
}
