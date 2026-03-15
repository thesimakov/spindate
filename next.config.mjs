/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
/** В CI только workflow GitHub Pages задаёт BUILD_FOR_PAGES — тогда статический экспорт. Для деплоя на свой сервер сборка без export. */
const isGitHubPages = process.env.BUILD_FOR_PAGES === "true"
const nextConfig = {
  basePath: basePath || undefined,
  ...(isGitHubPages && { output: "export" }),
  turbopack: {
    root: process.cwd(),
  },
  typescript: {
    ignoreBuildErrors: true,
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
