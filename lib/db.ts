import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"

let db: Database.Database | null = null

function ensureDataDir() {
  const configured = (process.env.SPINDATE_DATA_DIR ?? "").trim()
  const dir = configured
    ? path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured)
    : path.join(process.cwd(), "data")
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
      status TEXT NOT NULL DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS vk_user_game_state (
      vk_user_id INTEGER PRIMARY KEY,
      voice_balance INTEGER NOT NULL DEFAULT 0,
      inventory_json TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vk_payment_orders (
      provider_order_id TEXT PRIMARY KEY,
      vk_user_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      notification_type TEXT NOT NULL,
      status TEXT,
      processed INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_vk_user_game_state_updated_at ON vk_user_game_state(updated_at);
    CREATE INDEX IF NOT EXISTS idx_vk_payment_orders_vk_user_id ON vk_payment_orders(vk_user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_vk_user_id_unique ON users(vk_user_id);

    CREATE TABLE IF NOT EXISTS user_admin_flags (
      user_id TEXT PRIMARY KEY,
      blocked_until INTEGER,
      banned_until INTEGER,
      deleted INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_user_admin_flags_blocked_until ON user_admin_flags(blocked_until);
    CREATE INDEX IF NOT EXISTS idx_user_admin_flags_banned_until ON user_admin_flags(banned_until);
  `)

  const userCols = database.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]
  if (!userCols.some((c) => c.name === "vk_user_id")) {
    // SQLite не позволяет ADD COLUMN ... UNIQUE. Добавляем колонку отдельно,
    // а уникальность обеспечиваем индексом idx_users_vk_user_id_unique выше.
    database.exec(`ALTER TABLE users ADD COLUMN vk_user_id INTEGER`)
  }
  const profileCols = database.prepare(`PRAGMA table_info(player_profiles)`).all() as { name: string }[]
  if (!profileCols.some((c) => c.name === "status")) {
    database.exec(`ALTER TABLE player_profiles ADD COLUMN status TEXT NOT NULL DEFAULT ''`)
  }
}

export function getDb() {
  if (db) return db
  const dir = ensureDataDir()
  const file = path.join(dir, "auth.sqlite")
  db = new Database(file)
  migrate(db)
  return db
}

