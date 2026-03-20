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
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://vk.com https://vk.ru https://*.vk.com https://*.vk.ru",
          },
        ],
      },
    ]
  },
}

export default nextConfig
