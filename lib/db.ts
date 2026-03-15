import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"

let db: Database.Database | null = null

function ensureDataDir() {
  const dir = path.join(process.cwd(), "data")
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function migrate(database: Database.Database) {
  database.pragma("foreign_keys = ON")
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_profiles (
      user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      avatar_url TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT 'male',
      age INTEGER NOT NULL DEFAULT 25,
      purpose TEXT NOT NULL DEFAULT 'communication',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_game_state (
      user_id TEXT PRIMARY KEY,
      voice_balance INTEGER NOT NULL DEFAULT 0,
      inventory_json TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `)
}

export function getDb() {
  if (db) return db
  const dir = ensureDataDir()
  const file = path.join(dir, "auth.sqlite")
  db = new Database(file)
  migrate(db)
  return db
}

