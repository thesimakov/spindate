/** @type {import('next').NextConfig} */
/** В CI только workflow GitHub Pages задаёт BUILD_FOR_PAGES — тогда статический экспорт. Для деплоя на свой сервер сборка без export. */
const isGitHubPages = process.env.BUILD_FOR_PAGES === "true"
const basePath = isGitHubPages ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "") : ""
const nextConfig = {
  basePath: basePath || undefined,
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
        source: "/(.*)",
        headers: [csp],
      },
    ]
  },
}

export default nextConfig
