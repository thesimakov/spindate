/**
 * Базовый путь при деплое в подпапку (NEXT_PUBLIC_BASE_PATH).
 * Полный URL приложения (NEXT_PUBLIC_APP_URL) — для iframe / VK Mini App.
 *
 * В браузере basePath при необходимости берётся из pathname (первый сегмент URL),
 * чтобы картинки грузились даже если переменная не была задана при сборке.
 */
const BUILD_BASE_PATH =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BASE_PATH
    ? String(process.env.NEXT_PUBLIC_BASE_PATH).replace(/\/$/, "")
    : ""
const APP_URL =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_URL
    ? String(process.env.NEXT_PUBLIC_APP_URL).replace(/\/$/, "")
    : ""

function getBasePath(): string {
  if (typeof window === "undefined") return BUILD_BASE_PATH
  if (BUILD_BASE_PATH) return BUILD_BASE_PATH
  const pathname = window.location.pathname
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length > 0) return "/" + segments[0]
  return ""
}

/** Возвращает URL статического файла из public/assets/. В браузере — полный URL (origin + path), чтобы картинки грузились в каталоге и в iframe. */
export function assetUrl(path: string): string {
  let p = path.startsWith("/") ? path.slice(1) : path
  if (!p.startsWith("assets/")) p = "assets/" + p
  const base = getBasePath()
  const fullPath = (base ? base.replace(/\/$/, "") + "/" : "/") + p

  if (typeof window !== "undefined") {
    return window.location.origin + fullPath
  }

  if (APP_URL) return `${APP_URL.replace(/\/$/, "")}${fullPath}`
  return fullPath
}

/** Пути к картинкам бутылочек (каталог, игра) */
export const BOTTLE_IMAGES = {
  classic: "/assets/b_standart_v2.webp",
  ruby: "/assets/b_lemonade_v2.webp",
  neon: "/assets/b_jackdaniels_v3-20d33615-6586-4c75-923c-375c37dae0e3.webp",
  frost: "/assets/b_champagne_v3-9fde6437-79bd-474a-bff6-6ce9a8d187b0.webp",
  baby: "/assets/b_baby.webp",
  vip: "/assets/b_vip_v2.webp",
  milk: "/assets/b_milk_v2.webp",
} as const

/** Картинка эмоции «баня» (веник) */
export const EMOJI_BANYA = "/assets/7786876.svg"

/** Остальные картинки (фон, декор) — все в assets */
export const ASSET_GROUP = "/assets/Group.png"
export const ASSET_WOOD_BG = "/assets/wood-bg.jpg"
export const ASSET_FELT_GREEN = "/assets/felt-green.jpg"
