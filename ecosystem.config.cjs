/** PM2: запуск Next.js на сервере. Использование: pm2 start ecosystem.config.cjs */
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
