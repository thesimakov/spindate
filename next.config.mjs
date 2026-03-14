/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
const isGitHubPages = process.env.GITHUB_ACTIONS === "true"
const nextConfig = {
  basePath: basePath || undefined,
  ...(isGitHubPages && { output: "export" }),
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
