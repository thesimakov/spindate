import path from "node:path"

/** Публичный URL-префикс; обрабатывается Next.js (обходит nginx-only static /assets/). */
export const CATALOG_UPLOAD_API_PREFIX = "/api/catalog/upload-asset"

const ALLOWED_BUCKETS = new Set(["bottle", "frame", "gift", "misc", "achievement_post"])

/** Имена файлов, которые создаёт только админский upload-image. */
export const CATALOG_UPLOAD_FILENAME_RE = /^catalog-\d+-[a-f0-9]{8}\.(png|jpe?g|webp|gif|svg)$/i

function getSpindateDataDir(): string {
  const configured = (process.env.SPINDATE_DATA_DIR ?? "").trim()
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
  }
  return path.join(process.cwd(), "data")
}

/** Каталог на диске: рядом с SQLite (учитывает SPINDATE_DATA_DIR). */
export function getCatalogUploadRoot(): string {
  return path.join(getSpindateDataDir(), "catalog-uploads")
}

export function isAllowedCatalogUploadBucket(bucket: string): boolean {
  return ALLOWED_BUCKETS.has(bucket)
}

export function catalogUploadPublicPath(bucket: string, fileName: string): string {
  return `${CATALOG_UPLOAD_API_PREFIX}/${bucket}/${fileName}`
}
