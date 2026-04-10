-- База для входа не через VK (SQLite).
-- Пароли не храним в открытом виде: только хэш + соль.
-- Сессии: в cookie кладём "сырой" токен, в БД храним только его SHA-256.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                 -- UUID
  username TEXT NOT NULL UNIQUE,        -- login
  password_hash TEXT NOT NULL,          -- base64(scrypt)
  password_salt TEXT NOT NULL,          -- base64(random)
  created_at INTEGER NOT NULL,          -- epoch ms
  updated_at INTEGER NOT NULL           -- epoch ms
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                 -- UUID
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,      -- base64(sha256(token))
  created_at INTEGER NOT NULL,          -- epoch ms
  expires_at INTEGER NOT NULL,          -- epoch ms
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

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS achievement_post_templates (
  achievement_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  post_text_template TEXT NOT NULL DEFAULT '',
  vk_enabled INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  display_title TEXT NOT NULL DEFAULT '',
  hint_custom TEXT NOT NULL DEFAULT '',
  default_status_custom TEXT NOT NULL DEFAULT '',
  target_count INTEGER
);
CREATE INDEX IF NOT EXISTS idx_achievement_post_templates_published ON achievement_post_templates(published, updated_at);
