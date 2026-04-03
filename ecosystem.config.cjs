/** PM2: запуск Next.js на сервере. Использование: pm2 start ecosystem.config.cjs
 *  Nginx: proxy_pass http://127.0.0.1:<PORT> — тот же PORT, что ниже.
 *  На одном VPS с rps-vk-game: тот проект — порт 3001, spindate — 3002 (не пересекаются).
 *  Если nginx смотрит не на тот порт — стили/чанки с /_next/static часто дают 500/502.
 *
 *  Zero-downtime: деплой создаёт releases/ и переключает symlink current/.
 *  PM2 reload (graceful restart) подхватывает новый код из cwd.
 *  Данные (Redis, SQLite) живут вне releases/ и не теряются. */
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
      env: {
        NODE_ENV: "production",
        PORT: "3002",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "3002",
      },
    },
  ],
};
