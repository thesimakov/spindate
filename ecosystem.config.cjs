/** PM2: запуск Next.js на сервере. Использование: pm2 start ecosystem.config.cjs
 *  Nginx: proxy_pass http://127.0.0.1:<PORT> — тот же PORT, что ниже (по умолчанию 3001).
 *  Если в nginx оставить 3000, а здесь 3001 — стили и чанлы с /_next/static часто отдаются с 500/502. */
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
        PORT: "3001",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "3001",
      },
    },
  ],
};
