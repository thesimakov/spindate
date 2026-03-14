/**
 * Базовый путь при деплое в подпапку (NEXT_PUBLIC_BASE_PATH).
 * Полный URL приложения (NEXT_PUBLIC_APP_URL) — чтобы картинки грузились
 * с правильного домена в iframe / VK Mini App.
 */
const BASE_PATH =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BASE_PATH
    ? process.env.NEXT_PUBLIC_BASE_PATH.replace(/\/$/, "")
    : ""
const APP_URL =
  (typeof process !== "undefined"
    ? (process.env?.NEXT_PUBLIC_APP_URL ?? "https://spindate.lemnity.ru")
    : ""
  ).replace(/\/$/, "")

/** Возвращает URL статического файла из public/ (абсолютный, если задан NEXT_PUBLIC_APP_URL). */
export function assetUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`
  const fullPath = BASE_PATH + p
  if (APP_URL) return `${APP_URL}${fullPath}`
  return fullPath || p
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
