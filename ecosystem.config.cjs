/** PM2: запуск Next.js на сервере. Использование: pm2 start ecosystem.config.cjs
 *  Nginx: proxy_pass http://127.0.0.1:<PORT> — тот же PORT, что ниже.
 *  На одном VPS с rps-vk-game: тот проект — порт 3001, spindate — 3002 (не пересекаются).
 *  Если nginx смотрит не на тот порт — стили/чанки с /_next/static часто дают 500/502.
 *
 *  Zero-downtime: деплой создаёт releases/ и переключает symlink current/.
 *  PM2 reload (graceful restart) подхватывает новый код из cwd.
 *  Данные (Redis, SQLite) живут вне releases/ и не теряются.
 *
 *  Общие секреты: ../../shared/.env.local относительно каталога релиза (releases/…).
 *  PM2 подмешивает их в env процесса — видно в `pm2 env 0`, Next тоже их видит. */
const fs = require("node:fs")
const path = require("node:path")

function parseDotEnvFile(filePath) {
  const out = {}
  try {
    if (!fs.existsSync(filePath)) return out
    const text = fs.readFileSync(filePath, "utf8")
    for (let line of text.split("\n")) {
      line = line.trim()
      if (!line || line.startsWith("#")) continue
      const eq = line.indexOf("=")
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
      let val = line.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      out[key] = val
    }
  } catch {
    // ignore
  }
  return out
}

const sharedEnvPath = path.join(__dirname, "..", "..", "shared", ".env.local")
const sharedEnv = parseDotEnvFile(sharedEnvPath)

const baseEnv = {
  ...sharedEnv,
  NODE_ENV: "production",
  PORT: process.env.PORT || sharedEnv.PORT || "3002",
}

module.exports = {
  apps: [
    {
      name: "spindate",
      cwd: __dirname,
      script: "node",
      args: "node_modules/next/dist/bin/next start",
      instances: 1,
      exec_mode: "fork",
      kill_timeout: 5000,
      listen_timeout: 10000,
      wait_ready: false,
      env: { ...baseEnv },
      env_production: { ...baseEnv },
    },
  ],
}
