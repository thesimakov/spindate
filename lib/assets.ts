/**
 * Базовый путь при деплое в подпапку (NEXT_PUBLIC_BASE_PATH).
 * Полный URL приложения (NEXT_PUBLIC_APP_URL) — для iframe / VK Mini App.
 *
 * В браузере basePath при необходимости берётся из pathname (первый сегмент URL),
 * чтобы картинки грузились даже если переменная не была задана при сборке.
 */
const IS_PAGES_BUILD =
  typeof process !== "undefined" && process.env?.BUILD_FOR_PAGES === "true"
const BUILD_BASE_PATH =
  IS_PAGES_BUILD && typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BASE_PATH
    ? String(process.env.NEXT_PUBLIC_BASE_PATH).replace(/\/$/, "")
    : ""
const APP_URL =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_URL
    ? String(process.env.NEXT_PUBLIC_APP_URL).replace(/\/$/, "")
    : ""

function getBasePath(): string {
  // SSR: используем только переменную сборки
  if (typeof window === "undefined") return BUILD_BASE_PATH
  // В браузере сначала используем basePath из сборки.
  // Это важно для деплоя в подпапку на собственном домене (не github.io).
  if (BUILD_BASE_PATH) return BUILD_BASE_PATH

  // Фолбэк: на GitHub Pages basePath = первый сегмент URL.
  const host = window.location.hostname
  if (host.includes("github.io") || host.includes("github.com")) {
    const segments = window.location.pathname.split("/").filter(Boolean)
    if (segments.length > 0) return "/" + segments[0]
  }
  return ""
}

/** Версия для сброса кэша (менять после обновления картинок) */
const ASSET_CACHE_VERSION = "6"

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

/** URL произвольного файла из public/ (без автодобавления assets/). */
export function publicUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`
  const base = getBasePath()
  const fullPath = (base ? base.replace(/\/$/, "") : "") + p
  const q = ASSET_CACHE_VERSION ? `?v=${ASSET_CACHE_VERSION}` : ""
  if (typeof window !== "undefined") return fullPath + q
  if (APP_URL) return `${APP_URL.replace(/\/$/, "")}${fullPath}${q}`
  return fullPath + q
}

/** Статика из `public/assets/` или загрузки каталога через API (`/api/catalog/upload-asset/...`). */
export function catalogMediaUrl(path: string): string {
  const trimmed = String(path ?? "").trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const pathOnly = (trimmed.split("?")[0]?.split("#")[0] ?? trimmed).replaceAll("\\", "/")
  const normalized = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`
  if (normalized.startsWith("/api/")) return publicUrl(normalized)
  return assetUrl(normalized)
}

/** Путь к картинке/SVG рамки из каталога (статика, загрузка через API или полный URL). */
export function resolveFrameCatalogAssetUrl(path: string): string {
  const raw = String(path ?? "").trim()
  if (!raw) return ""
  if (/^https?:\/\//i.test(raw)) return raw
  const p = (raw.split("?")[0]?.split("#")[0] ?? raw).replaceAll("\\", "/")
  if (p.startsWith("/api/") || p.startsWith("api/")) {
    return catalogMediaUrl(p.startsWith("/") ? p : `/${p}`)
  }
  if (p.startsWith("/")) return catalogMediaUrl(p)
  return catalogMediaUrl(`/assets/${p}`)
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
  frame_69: "/assets/Frame 69.webp",
  frame_70: "/assets/Frame 70.webp",
  frame_71: "/assets/Frame 71.webp",
  frame_72: "/assets/Frame 72.webp",
  frame_73: "/assets/Frame 73.webp",
  frame_74: "/assets/Frame 74.webp",
  frame_75: "/assets/Frame 75.webp",
  frame_76: "/assets/Frame 76.webp",
  frame_77: "/assets/Frame 77.webp",
  frame_78: "/assets/Frame 78.webp",
  frame_79: "/assets/Frame 79.webp",
  frame_80: "/assets/Frame 80.webp",
} as const

/** Картинка эмоции «баня» (веник) */
export const EMOJI_BANYA = "/assets/7786876.svg"

/** Звуки при эмоциях (MP3 в public/assets/; путь `music/…` — из public/music/) */
export const EMOTION_SOUNDS: Record<string, string> = {
  /** Дарение предмета из каталога подарков — один общий SFX для всех id подарков */
  gift_catalog: "9160bfefbb62e94654645.mp3",
  kiss: "kiss_mkqxy6eu.mp3",
  diamond: "001_38372.mp3",
  flowers: "546546745.mp3",
  beer: "dne-can-open-medium.mp3",
  cocktail: "music/567787ce397a02e.mp3",
  banya: "2de04e7deb74c4b.mp3",
  tools: "power_tool_electric_screwdriver_2.mp3",
}

/** URL файла из {@link EMOTION_SOUNDS}: `music/…` → public/music/, иначе public/assets/ */
export function emotionSoundUrl(fileRef: string): string {
  if (fileRef.startsWith("music/")) return publicUrl(fileRef)
  return assetUrl(fileRef)
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
