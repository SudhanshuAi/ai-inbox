import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      event: 'http_request',
      requestId: req.requestId,
      method: req.method,
      route: req.route?.path ?? req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
}
