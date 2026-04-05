import { execSync } from "node:child_process"

/** @type {import('next').NextConfig} */
/** В CI только workflow GitHub Pages задаёт BUILD_FOR_PAGES — тогда статический экспорт. Для деплоя на свой сервер сборка без export. */
const isGitHubPages = process.env.BUILD_FOR_PAGES === "true"
const basePath = isGitHubPages ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "") : ""

function resolvePublicBuildId() {
  const fromEnv = process.env.NEXT_PUBLIC_BUILD_ID?.trim()
  if (fromEnv) return fromEnv
  const vercel = process.env.VERCEL_GIT_COMMIT_SHA?.trim()
  if (vercel) return vercel.slice(0, 12)
  try {
    return execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return "dev"
  }
}

const nextConfig = {
  /** Не бандлить ioredis/node-cron — иначе Turbopack тянет Node `stream`/`net` и падает (instrumentation → purge → Redis). */
  serverExternalPackages: ["ioredis", "node-cron"],
  basePath: basePath || undefined,
  env: {
    NEXT_PUBLIC_BUILD_ID: resolvePublicBuildId(),
  },
  ...(isGitHubPages && { output: "export" }),
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    const csp = {
      key: "Content-Security-Policy",
      value: "frame-ancestors 'self' https://vk.com https://vk.ru https://*.vk.com https://*.vk.ru",
    }
    return [
      /**
       * Главная: не отдавать из кэша устаревший HTML — иначе после деплоя подтягиваются старые хэши
       * в <link>/<script>, а на диске уже новый .next → 500/битый визуал до жёсткого обновления.
       */
      {
        source: "/",
        headers: [
          csp,
          {
            key: "Cache-Control",
            value: "private, no-store, must-revalidate",
          },
        ],
      },
      /** Не кэшировать HTML админки годами — иначе после деплоя браузер тянет старые ссылки на /_next/static/* (404, чёрный экран). */
      {
        source: "/admin-lemnity",
        headers: [
          csp,
          {
            key: "Cache-Control",
            value: "private, no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/admin-lemnity/(.*)",
        headers: [
          csp,
          {
            key: "Cache-Control",
            value: "private, no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [csp],
      },
    ]
  },
}

export default nextConfig
