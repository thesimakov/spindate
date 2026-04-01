/**
 * Префикс приложения (NEXT_PUBLIC_BASE_PATH): GitHub Pages, VK Mini App в подпапке.
 * Без завершающего слэша. Пустая строка — приложение в корне домена.
 */
export const APP_BASE_PATH = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_PATH
  ? String(process.env.NEXT_PUBLIC_BASE_PATH)
  : ""
).replace(/\/$/, "")

/**
 * Оригин бэкенда с API, если фронт отдаётся статикой без Route Handlers.
 */
export const API_BASE_ORIGIN = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL
  ? String(process.env.NEXT_PUBLIC_API_BASE_URL).replace(/\/$/, "")
  : ""
).trim()

/**
 * Абсолютный URL или путь: страницы — с basePath (GitHub Pages), API при NEXT_PUBLIC_API_BASE_URL — на бэкенд в корне `/api/...` (без basePath).
 */
export function appPath(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href
  const path = href.startsWith("/") ? href : `/${href}`
  if (API_BASE_ORIGIN && path.startsWith("/api/")) {
    return `${API_BASE_ORIGIN}${path}`
  }
  return `${APP_BASE_PATH}${path}`
}
