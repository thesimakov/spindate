/** PM2: запуск Next.js на сервере. Использование: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "spindate",
      cwd: __dirname,
      script: "node_modules/.bin/next",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
