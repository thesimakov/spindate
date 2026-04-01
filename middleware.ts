import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

/**
 * CORS для /api/*: статический фронт (GitHub Pages) и VK WebView ходят на бэкенд spindate.lemnity.ru.
 * Доп. origin через CORS_ALLOWED_ORIGINS (через запятую) на сервере.
 */
function allowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin")
  if (!origin) return null

  const extras =
    process.env.CORS_ALLOWED_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []

  const builtins = [
    "https://spindate.lemnity.ru",
    "https://thesimakov.github.io",
    "https://vk.com",
    "https://vk.ru",
    "https://m.vk.com",
    "https://id.vk.com",
    "https://oauth.vk.com",
    ...extras,
  ]

  if (builtins.includes(origin)) return origin

  try {
    const u = new URL(origin)
    if (u.hostname.endsWith(".vk.com") || u.hostname.endsWith(".vk.ru")) return origin
  } catch {
    return null
  }

  return null
}

export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    const allow = allowedOrigin(request)
    if (!allow) {
      return new NextResponse(null, { status: 204 })
    }
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allow,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Session-Token, X-Admin-Token, Authorization",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    })
  }

  const res = NextResponse.next()
  const allow = allowedOrigin(request)
  if (allow) {
    res.headers.set("Access-Control-Allow-Origin", allow)
    res.headers.set("Access-Control-Allow-Credentials", "true")
    res.headers.append("Vary", "Origin")
  }
  return res
}

export const config = {
  matcher: "/api/:path*",
}
