/** PM2: запуск Next.js на сервере. Использование: pm2 start ecosystem.config.cjs
 *  Nginx: proxy_pass http://127.0.0.1:<PORT> — тот же PORT, что ниже.
 *  На одном VPS с rps-vk-game: тот проект — порт 3001, spindate — 3002 (не пересекаются).
 *  Если nginx смотрит не на тот порт — стили/чанки с /_next/static часто дают 500/502. */
module.exports = {
  apps: [
    {
      name: "spindate",
      cwd: __dirname,
      script: "node",
      args: "node_modules/next/dist/bin/next start",
      instances: 1,
      exec_mode: "fork",
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
