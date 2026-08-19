import { createRequire } from 'node:module';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

const req = createRequire(path.join(process.cwd(), 'index.js'));
const { DatabaseSync } = req('node:sqlite');

// Type alias for DatabaseSync
type DatabaseSyncInstance = InstanceType<typeof DatabaseSync>;

let _db: DatabaseSyncInstance | null = null;

export function getDb(): DatabaseSyncInstance {
  if (_db) return _db;

  // Ensure data directory exists if not memory
  if (config.SQLITE_PATH !== ':memory:') {
    const dbDir = path.dirname(path.resolve(config.SQLITE_PATH));
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  _db = new DatabaseSync(config.SQLITE_PATH);
  _db.exec('PRAGMA journal_mode = WAL;');
  _db.exec('PRAGMA foreign_keys = ON;');
  _db.exec('PRAGMA busy_timeout = 5000;');

  runMigrations(_db);
  logger.info({ event: 'db_connected', path: config.SQLITE_PATH });
  return _db;
}

function runMigrations(db: DatabaseSyncInstance): void {
  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    logger.warn({ event: 'migrations_dir_missing', path: migrationsDir });
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedRows = db.prepare('SELECT name FROM migrations').all() as { name: string }[];
  const applied = new Set<string>(appliedRows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
    logger.info({ event: 'migration_applied', file });
  }
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
