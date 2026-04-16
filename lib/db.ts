import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { DEFAULT_BOTTLE_CATALOG_SKINS } from "@/lib/bottle-catalog"
import { DEFAULT_FRAME_CATALOG_ROWS } from "@/lib/frame-catalog"
import { DEFAULT_GIFT_CATALOG_ROWS } from "@/lib/gift-catalog"

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
      visual_prefs_json TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vk_user_game_state (
      vk_user_id INTEGER PRIMARY KEY,
      voice_balance INTEGER NOT NULL DEFAULT 0,
      inventory_json TEXT NOT NULL DEFAULT '[]',
      visual_prefs_json TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ok_user_game_state (
      ok_user_id INTEGER PRIMARY KEY,
      voice_balance INTEGER NOT NULL DEFAULT 0,
      inventory_json TEXT NOT NULL DEFAULT '[]',
      visual_prefs_json TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL,
      ok_group_bonus_claimed INTEGER NOT NULL DEFAULT 0
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
    CREATE INDEX IF NOT EXISTS idx_ok_user_game_state_updated_at ON ok_user_game_state(updated_at);

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

    CREATE TABLE IF NOT EXISTS bottle_catalog (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      img TEXT NOT NULL DEFAULT '',
      section TEXT NOT NULL DEFAULT 'paid',
      cost INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      deleted INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bottle_catalog_published ON bottle_catalog(published, deleted, sort_order);

    CREATE TABLE IF NOT EXISTS gift_catalog (
      id TEXT PRIMARY KEY,
      section TEXT NOT NULL DEFAULT 'paid',
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '🎁',
      img TEXT NOT NULL DEFAULT '',
      cost INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      deleted INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gift_catalog_published ON gift_catalog(published, deleted, sort_order);

    CREATE TABLE IF NOT EXISTS frame_catalog (
      id TEXT PRIMARY KEY,
      section TEXT NOT NULL DEFAULT 'free',
      name TEXT NOT NULL,
      border TEXT NOT NULL DEFAULT '2px solid #475569',
      shadow TEXT NOT NULL DEFAULT 'none',
      animation_class TEXT NOT NULL DEFAULT '',
      svg_path TEXT NOT NULL DEFAULT '',
      cost INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      deleted INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_frame_catalog_published ON frame_catalog(published, deleted, sort_order);

    CREATE TABLE IF NOT EXISTS status_line (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      text TEXT NOT NULL DEFAULT '',
      published INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lobby_announcement (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      button_label TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      published INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS table_style_catalog (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_table_style_catalog_published ON table_style_catalog(published, sort_order);

    CREATE TABLE IF NOT EXISTS table_style_global (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      style_id TEXT NOT NULL DEFAULT 'classic_night',
      updated_at INTEGER NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS global_rating_events (
      dedupe_id TEXT PRIMARY KEY,
      table_id INTEGER NOT NULL,
      actor_key TEXT NOT NULL,
      category TEXT NOT NULL,
      weight INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_global_rating_events_created ON global_rating_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_global_rating_events_actor_created ON global_rating_events(actor_key, created_at);
    CREATE INDEX IF NOT EXISTS idx_global_rating_events_cat_created ON global_rating_events(category, created_at);
  `)

  const achievementPostCols = database.prepare(`PRAGMA table_info(achievement_post_templates)`).all() as { name: string }[]
  if (achievementPostCols.length > 0) {
    if (!achievementPostCols.some((c) => c.name === "display_title")) {
      database.exec(`ALTER TABLE achievement_post_templates ADD COLUMN display_title TEXT NOT NULL DEFAULT ''`)
    }
    if (!achievementPostCols.some((c) => c.name === "hint_custom")) {
      database.exec(`ALTER TABLE achievement_post_templates ADD COLUMN hint_custom TEXT NOT NULL DEFAULT ''`)
    }
    if (!achievementPostCols.some((c) => c.name === "default_status_custom")) {
      database.exec(`ALTER TABLE achievement_post_templates ADD COLUMN default_status_custom TEXT NOT NULL DEFAULT ''`)
    }
    if (!achievementPostCols.some((c) => c.name === "target_count")) {
      database.exec(`ALTER TABLE achievement_post_templates ADD COLUMN target_count INTEGER`)
    }
  }

  const userCols = database.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]
  if (!userCols.some((c) => c.name === "vk_user_id")) {
    // SQLite не позволяет ADD COLUMN ... UNIQUE. Добавляем колонку отдельно,
    // а уникальность обеспечиваем индексом idx_users_vk_user_id_unique ниже.
    database.exec(`ALTER TABLE users ADD COLUMN vk_user_id INTEGER`)
  }
  // Индекс создаём только после гарантии колонки vk_user_id (для старых БД иначе падал migrate).
  database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_vk_user_id_unique ON users(vk_user_id)`)
  const userColsAfterVk = database.prepare(`PRAGMA table_info(users)`).all() as { name: string }[]
  if (!userColsAfterVk.some((c) => c.name === "ok_user_id")) {
    database.exec(`ALTER TABLE users ADD COLUMN ok_user_id INTEGER`)
  }
  database.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ok_user_id_unique ON users(ok_user_id) WHERE ok_user_id IS NOT NULL`,
  )
  const profileCols = database.prepare(`PRAGMA table_info(player_profiles)`).all() as { name: string }[]
  if (!profileCols.some((c) => c.name === "status")) {
    database.exec(`ALTER TABLE player_profiles ADD COLUMN status TEXT NOT NULL DEFAULT ''`)
  }
  if (!profileCols.some((c) => c.name === "city")) {
    database.exec(`ALTER TABLE player_profiles ADD COLUMN city TEXT NOT NULL DEFAULT ''`)
  }
  if (!profileCols.some((c) => c.name === "zodiac")) {
    database.exec(`ALTER TABLE player_profiles ADD COLUMN zodiac TEXT NOT NULL DEFAULT ''`)
  }
  if (!profileCols.some((c) => c.name === "interests")) {
    database.exec(`ALTER TABLE player_profiles ADD COLUMN interests TEXT NOT NULL DEFAULT ''`)
  }
  const bottleCols = database.prepare(`PRAGMA table_info(bottle_catalog)`).all() as { name: string }[]
  if (!bottleCols.some((c) => c.name === "section")) {
    database.exec(`ALTER TABLE bottle_catalog ADD COLUMN section TEXT NOT NULL DEFAULT 'paid'`)
    database.exec(`UPDATE bottle_catalog SET section = 'free' WHERE cost = 0 OR id = 'classic'`)
    database.exec(`UPDATE bottle_catalog SET section = 'vip' WHERE id IN ('vip', 'fortune_wheel')`)
  }
  if (!bottleCols.some((c) => c.name === "is_main")) {
    database.exec(`ALTER TABLE bottle_catalog ADD COLUMN is_main INTEGER NOT NULL DEFAULT 0`)
  }
  const hasPremiumGifts = (database.prepare(`SELECT COUNT(*) as c FROM gift_catalog WHERE section = 'premium'`).get() as { c: number })?.c > 0
  if (hasPremiumGifts) {
    database.exec(`UPDATE gift_catalog SET section = 'paid' WHERE section = 'premium'`)
    database.exec(`UPDATE gift_catalog SET section = 'vip' WHERE section = 'paid' AND cost >= 10`)
  }
  const giftCols = database.prepare(`PRAGMA table_info(gift_catalog)`).all() as { name: string }[]
  if (!giftCols.some((c) => c.name === "img")) {
    database.exec(`ALTER TABLE gift_catalog ADD COLUMN img TEXT NOT NULL DEFAULT ''`)
  }
  const giftColsPay = database.prepare(`PRAGMA table_info(gift_catalog)`).all() as { name: string }[]
  if (!giftColsPay.some((c) => c.name === "pay_currency")) {
    database.exec(`ALTER TABLE gift_catalog ADD COLUMN pay_currency TEXT NOT NULL DEFAULT 'hearts'`)
  }
  const giftColsStock = database.prepare(`PRAGMA table_info(gift_catalog)`).all() as { name: string }[]
  if (!giftColsStock.some((c) => c.name === "stock")) {
    database.exec(`ALTER TABLE gift_catalog ADD COLUMN stock INTEGER NOT NULL DEFAULT -1`)
  }
  const giftColsMusic = database.prepare(`PRAGMA table_info(gift_catalog)`).all() as { name: string }[]
  if (!giftColsMusic.some((c) => c.name === "music")) {
    database.exec(`ALTER TABLE gift_catalog ADD COLUMN music TEXT NOT NULL DEFAULT ''`)
  }
  const hasPremiumFrames = (database.prepare(`SELECT COUNT(*) as c FROM frame_catalog WHERE section = 'premium'`).get() as { c: number })?.c > 0
  if (hasPremiumFrames) {
    database.exec(`UPDATE frame_catalog SET section = 'paid' WHERE section = 'premium'`)
    database.exec(`UPDATE frame_catalog SET section = 'vip' WHERE section = 'paid' AND cost >= 10`)
  }

  const gameStateCols = database.prepare(`PRAGMA table_info(user_game_state)`).all() as { name: string }[]
  if (!gameStateCols.some((c) => c.name === "visual_prefs_json")) {
    database.exec(`ALTER TABLE user_game_state ADD COLUMN visual_prefs_json TEXT NOT NULL DEFAULT '{}'`)
  }
  if (!gameStateCols.some((c) => c.name === "vip_until")) {
    database.exec(`ALTER TABLE user_game_state ADD COLUMN vip_until INTEGER NOT NULL DEFAULT 0`)
  }
  if (!gameStateCols.some((c) => c.name === "vk_group_bonus_claimed")) {
    database.exec(`ALTER TABLE user_game_state ADD COLUMN vk_group_bonus_claimed INTEGER NOT NULL DEFAULT 0`)
  }

  const vkGameStateCols = database.prepare(`PRAGMA table_info(vk_user_game_state)`).all() as { name: string }[]
  if (!vkGameStateCols.some((c) => c.name === "visual_prefs_json")) {
    database.exec(`ALTER TABLE vk_user_game_state ADD COLUMN visual_prefs_json TEXT NOT NULL DEFAULT '{}'`)
  }
  if (!vkGameStateCols.some((c) => c.name === "vk_group_bonus_claimed")) {
    database.exec(`ALTER TABLE vk_user_game_state ADD COLUMN vk_group_bonus_claimed INTEGER NOT NULL DEFAULT 0`)
  }

  const okGameStateCols = database.prepare(`PRAGMA table_info(ok_user_game_state)`).all() as { name: string }[]
  if (okGameStateCols.length > 0 && !okGameStateCols.some((c) => c.name === "visual_prefs_json")) {
    database.exec(`ALTER TABLE ok_user_game_state ADD COLUMN visual_prefs_json TEXT NOT NULL DEFAULT '{}'`)
  }
  if (okGameStateCols.length > 0 && !okGameStateCols.some((c) => c.name === "ok_group_bonus_claimed")) {
    database.exec(`ALTER TABLE ok_user_game_state ADD COLUMN ok_group_bonus_claimed INTEGER NOT NULL DEFAULT 0`)
  }

  // Старые инсталляции: vk_payment_orders могла быть создана без vk_user_id — IF NOT EXISTS таблицу не пересоздаёт.
  const paymentCols = database.prepare(`PRAGMA table_info(vk_payment_orders)`).all() as { name: string }[]
  if (paymentCols.length > 0 && !paymentCols.some((c) => c.name === "vk_user_id")) {
    database.exec(`ALTER TABLE vk_payment_orders ADD COLUMN vk_user_id INTEGER NOT NULL DEFAULT 0`)
  }
  // После гарантии колонки (в т.ч. для старых БД) — индекс вне первого exec, иначе при отсутствии колонки весь блок миграции падал.
  database.exec(
    `    CREATE INDEX IF NOT EXISTS idx_vk_payment_orders_vk_user_id ON vk_payment_orders(vk_user_id)`,
  )

  database.exec(`
    CREATE TABLE IF NOT EXISTS vk_ad_reward_claims (
      subject_key TEXT PRIMARY KEY,
      last_claim_at INTEGER NOT NULL,
      utc_day INTEGER NOT NULL DEFAULT 0,
      claims_today INTEGER NOT NULL DEFAULT 0
    );
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS ticker_player_ads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id TEXT,
      owner_vk_user_id INTEGER,
      author_display_name TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      link_url TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      cost_hearts INTEGER NOT NULL,
      status TEXT NOT NULL,
      paid_at INTEGER NOT NULL,
      queue_start_ms INTEGER,
      queue_end_ms INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      reject_reason TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ticker_player_ads_status ON ticker_player_ads(status);
    CREATE INDEX IF NOT EXISTS idx_ticker_player_ads_queue ON ticker_player_ads(status, queue_start_ms, queue_end_ms);
  `)

  // Порог VIP для подарков: 25 ❤ (раньше часто использовали 10)
  database.exec(`UPDATE gift_catalog SET section = 'paid' WHERE section = 'vip' AND cost < 25`)
  database.exec(`UPDATE frame_catalog SET section = 'paid' WHERE section = 'vip' AND cost < 25`)

  database.exec(`
    CREATE TABLE IF NOT EXISTS telegram_stars_pending (
      id TEXT PRIMARY KEY,
      app_user_id TEXT,
      vk_user_id INTEGER NOT NULL DEFAULT 0,
      hearts INTEGER NOT NULL,
      stars INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS telegram_stars_payments (
      charge_id TEXT PRIMARY KEY,
      app_user_id TEXT,
      vk_user_id INTEGER NOT NULL DEFAULT 0,
      hearts INTEGER NOT NULL,
      stars INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS game_client_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      source TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      stack TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_game_client_errors_created ON game_client_errors(created_at);
  `)

  const now = Date.now()
  const insertBottle = database.prepare(
    `INSERT INTO bottle_catalog (id, name, img, section, cost, published, deleted, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  )
  DEFAULT_BOTTLE_CATALOG_SKINS.forEach((row, index) => {
    insertBottle.run(row.id, row.name, row.imgPath, row.section, row.cost, row.published ? 1 : 0, index, now)
  })

  const insertGift = database.prepare(
    `INSERT INTO gift_catalog (id, section, name, emoji, img, cost, pay_currency, stock, published, deleted, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  )
  DEFAULT_GIFT_CATALOG_ROWS.forEach((row, index) => {
    insertGift.run(
      row.id,
      row.section,
      row.name,
      row.emoji,
      row.img ?? "",
      row.cost,
      row.payCurrency,
      row.stock ?? -1,
      row.published ? 1 : 0,
      index,
      now,
    )
  })

  const insertFrame = database.prepare(
    `INSERT INTO frame_catalog (
       id, section, name, border, shadow, animation_class, svg_path, cost, published, deleted, sort_order, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  )
  DEFAULT_FRAME_CATALOG_ROWS.forEach((row, index) => {
    insertFrame.run(
      row.id,
      row.section,
      row.name,
      row.border,
      row.shadow,
      row.animationClass ?? "",
      row.svgPath ?? "",
      row.cost,
      row.published ? 1 : 0,
      index,
      now,
    )
  })

  database
    .prepare(
      `INSERT INTO status_line (id, text, published, deleted, updated_at)
       VALUES (1, '', 0, 0, ?)
       ON CONFLICT(id) DO NOTHING`,
    )
    .run(now)

  database
    .prepare(
      `INSERT INTO lobby_announcement (id, title, body, button_label, image_url, published, deleted, updated_at)
       VALUES (1, '', '', '', '', 0, 0, ?)
       ON CONFLICT(id) DO NOTHING`,
    )
    .run(now)

  const tableStyles = [
    { id: "classic_night", name: "Классическая ночь", published: 1 },
    { id: "sunset_lounge", name: "Закатный лаунж", published: 1 },
    { id: "ocean_breeze", name: "Океанский бриз", published: 1 },
    { id: "violet_dream", name: "Фиолетовый сон", published: 1 },
    { id: "cosmic_rockets", name: "Космос и ракеты", published: 0 },
    { id: "light_day", name: "Светлый день", published: 1 },
    { id: "nebula_mockup", name: "Небула · макет", published: 1 },
  ] as const
  const insertTableStyle = database.prepare(
    `INSERT INTO table_style_catalog (id, name, published, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
  )
  tableStyles.forEach((row, index) => {
    insertTableStyle.run(row.id, row.name, row.published, index, now)
  })

  database
    .prepare(
      `INSERT INTO table_style_global (id, enabled, style_id, updated_at)
       VALUES (1, 0, 'classic_night', ?)
       ON CONFLICT(id) DO NOTHING`,
    )
    .run(now)
}

export function getDb() {
  if (db) return db
  const dir = ensureDataDir()
  const file = path.join(dir, "auth.sqlite")
  db = new Database(file)
  db.pragma("journal_mode = WAL")
  db.pragma("busy_timeout = 5000")
  migrate(db)
  return db
}

