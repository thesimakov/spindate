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
    /** Без .git каждая сборка должна иметь уникальный id, иначе клиент думает что v=«dev» и отключает авто-перезагрузку. */
    return `nobuild-${Date.now().toString(36)}`
  }
}

const nextConfig = {
  /** Не бандлить ioredis/node-cron — иначе сборщик тянет Node `stream`/`net`. */
  serverExternalPackages: ["ioredis", "@ioredis/commands", "node-cron"],
  basePath: basePath || undefined,
  env: {
    NEXT_PUBLIC_BUILD_ID: resolvePublicBuildId(),
  },
  ...(isGitHubPages && { output: "export" }),
  turbopack: {
    root: process.cwd(),
  },
  /** Дублируем external для `next dev --webpack` / части чанков, где serverExternalPackages не срабатывает. */
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals ?? []
      if (Array.isArray(config.externals)) {
        if (!config.externals.some((e) => e === "ioredis" || e === "@ioredis/commands")) {
          config.externals.push("ioredis", "@ioredis/commands")
        }
      }
    }
    return config
  },
  images: {
    unoptimized: true,
  },
  /** Браузеры запрашивают `/favicon.ico` по умолчанию; отдаём SVG без дублирования бинарного .ico. */
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/favicon.svg" }]
  },
  async headers() {
    /** ВК и ОК встраивают приложение в iframe; без доменов ОК страница не загружается в https://ok.ru/app/... */
    const csp = {
      key: "Content-Security-Policy",
      value:
        "frame-ancestors 'self' https://vk.com https://vk.ru https://*.vk.com https://*.vk.ru https://ok.ru https://*.ok.ru https://odnoklassniki.ru https://*.odnoklassniki.ru",
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
