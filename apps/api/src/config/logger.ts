import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    config.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  base: { env: config.NODE_ENV },
  redact: {
    paths: ['req.headers.authorization', '*.apiKey', '*.embedding', '*.embeddings'],
    censor: '[REDACTED]',
  },
});
