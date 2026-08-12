import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type AppDatabase = Database.Database;

const migrations = [
  `
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      normalized_username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
    CREATE TABLE projects (
      id TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (owner_id, id)
    );
    CREATE TABLE preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      theme TEXT NOT NULL DEFAULT 'dev' CHECK(theme IN ('dev', 'dark', 'light')),
      reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK(reduced_motion IN (0, 1)),
      confirm_delete INTEGER NOT NULL DEFAULT 1 CHECK(confirm_delete IN (0, 1)),
      autosave INTEGER NOT NULL DEFAULT 1 CHECK(autosave IN (0, 1))
    );
  `,
  `
    CREATE TABLE snapshots (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX snapshots_owner_created_idx ON snapshots(owner_id, created_at DESC);
  `,
  `
    CREATE TABLE current_workspaces (
      owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
];

export function migrateDatabase(db: AppDatabase): void {
  db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?');
  const record = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
  migrations.forEach((sql, index) => {
    const version = index + 1;
    if (applied.get(version)) return;
    db.transaction(() => {
      db.exec(sql);
      record.run(version, new Date().toISOString());
    })();
  });
}

export function openDatabase(filename = process.env.DATABASE_FILE || path.join(process.cwd(), 'data', 'akiiro-3d.sqlite')): AppDatabase {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  migrateDatabase(db);
  return db;
}
