import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { getDb } from './adapters/db.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { httpLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { itemsRouter } from './routes/items.js';
import { queryRouter } from './routes/query.js';

const app = express();

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: config.FRONTEND_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Request-Id'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware);
app.use(httpLogger);

// ─── Routes ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', database: 'connected', env: config.NODE_ENV });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.use(itemsRouter);
app.use(queryRouter);

// ─── Error handler (must be last) ───────────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────────
export function startServer(): void {
  // Initialize DB / run migrations on startup
  getDb();

  const server = app.listen(config.PORT, () => {
    logger.info({ event: 'server_started', port: config.PORT, env: config.NODE_ENV });
  });

  process.on('SIGTERM', () => {
    logger.info({ event: 'server_shutdown' });
    server.close(() => process.exit(0));
  });
}

// ─── Export app for tests ────────────────────────────────────────────────────
export { app };

// Start server when not in test environment
if (config.NODE_ENV !== 'test') {
  startServer();
}
