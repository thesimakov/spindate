import path from "node:path"
import { unlink } from "node:fs/promises"

function normalizePublicAssetPath(raw: string): string | null {
  const value = String(raw || "").trim()
  if (!value) return null
  const noQuery = value.split("?")[0]?.split("#")[0] ?? value
  const unixPath = noQuery.replaceAll("\\", "/")
  const withLeading = unixPath.startsWith("/") ? unixPath : `/${unixPath}`
  if (!withLeading.startsWith("/assets/admin-upload/")) return null
  return withLeading
}

export async function removeAdminUploadedAssetIfExists(rawPath: string): Promise<void> {
  const relPublicPath = normalizePublicAssetPath(rawPath)
  if (!relPublicPath) return
  const target = path.join(process.cwd(), "public", relPublicPath.slice(1))
  try {
    await unlink(target)
  } catch {
    // ignore if already missing
  }
}
