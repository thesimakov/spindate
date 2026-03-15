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
  // SSR: используем только переменную сборки
  if (typeof window === "undefined") return BUILD_BASE_PATH
  // В браузере всегда смотрим по хосту: одна сборка может быть на lemnity.ru (без basePath) и на GitHub Pages (с /spindate)
  const host = window.location.hostname
  if (host.includes("github.io") || host.includes("github.com")) {
    const segments = window.location.pathname.split("/").filter(Boolean)
    if (segments.length > 0) return "/" + segments[0]
  }
  return ""
}

/** Версия для сброса кэша (менять после обновления картинок) */
const ASSET_CACHE_VERSION = "5"

/** Возвращает URL статического файла из public/assets/. В браузере — полный URL (origin + path). */
export function assetUrl(path: string): string {
  let p = path.startsWith("/") ? path.slice(1) : path
  if (!p.startsWith("assets/")) p = "assets/" + p
  const base = getBasePath()
  const fullPath = (base ? base.replace(/\/$/, "") + "/" : "/") + p
  const q = ASSET_CACHE_VERSION ? `?v=${ASSET_CACHE_VERSION}` : ""

  if (typeof window !== "undefined") {
    // Относительный путь на том же origin — надёжнее на GitHub Pages и кэш CDN
    return fullPath + q
  }

  if (APP_URL) return `${APP_URL.replace(/\/$/, "")}${fullPath}${q}`
  return fullPath + q
}

/** Пути к картинкам бутылочек (каталог в игре + отображение на столе). Полный список — public/assets/README.md */
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

/** Звуки при эмоциях (MP3 в public/assets/) */
export const EMOTION_SOUNDS: Record<string, string> = {
  kiss: "kiss_mkqxy6eu.mp3",
  diamond: "001_38372.mp3",
  flowers: "546546745.mp3",
  beer: "dne-can-open-medium.mp3",
  cocktail: "9160bfefbb62e94654645.mp3",
  banya: "2de04e7deb74c4b.mp3",
  tools: "power_tool_electric_screwdriver_2.mp3",
}

/** Рамки-картинки для аватарки (SVG из assets, один формат — центрируем одинаково) */
export const FRAME_SVG = {
  rabbit: "/assets/ram-rabbit.svg",
  fairy: "/assets/ram-fea.svg",
  fox: "/assets/ram-lis.svg",
  mag: "/assets/ram-mag.svg",
  malif: "/assets/ram-malif.svg",
  mir: "/assets/ram-mir.svg",
  vesna: "/assets/ram-vesna.svg",
} as const

/** Остальные картинки (фон, декор) — все в assets */
export const ASSET_GROUP = "/assets/Group.png"
export const ASSET_WOOD_BG = "/assets/wood-bg.jpg"
export const ASSET_FELT_GREEN = "/assets/felt-green.jpg"
