import path from "node:path"
import { unlink } from "node:fs/promises"
import {
  CATALOG_UPLOAD_API_PREFIX,
  CATALOG_UPLOAD_FILENAME_RE,
  getCatalogUploadRoot,
  isAllowedCatalogUploadBucket,
} from "@/lib/catalog-upload-paths"

function normalizePath(raw: string): string | null {
  const value = String(raw || "").trim()
  if (!value) return null
  const noQuery = value.split("?")[0]?.split("#")[0] ?? value
  const unixPath = noQuery.replaceAll("\\", "/")
  return unixPath.startsWith("/") ? unixPath : `/${unixPath}`
}

async function removeCatalogApiUpload(withLeading: string): Promise<boolean> {
  const prefix = `${CATALOG_UPLOAD_API_PREFIX}/`
  if (!withLeading.startsWith(prefix)) return false
  const rest = withLeading.slice(prefix.length)
  const parts = rest.split("/").filter(Boolean)
  if (parts.length !== 2) return false
  const [bucket, fileName] = parts
  if (!isAllowedCatalogUploadBucket(bucket) || !CATALOG_UPLOAD_FILENAME_RE.test(fileName)) return false
  const root = path.resolve(getCatalogUploadRoot())
  const absTarget = path.resolve(root, bucket, fileName)
  const bucketRoot = path.resolve(root, bucket)
  if (!absTarget.startsWith(bucketRoot + path.sep) && absTarget !== bucketRoot) return false
  try {
    await unlink(absTarget)
  } catch {
    // ignore if already missing
  }
  return true
}

async function removePublicAsset(withLeading: string): Promise<void> {
  if (!withLeading.startsWith("/assets/")) return
  const target = path.join(process.cwd(), "public", withLeading.slice(1))
  try {
    await unlink(target)
  } catch {
    // ignore if already missing
  }
}

export async function removeAdminUploadedAssetIfExists(rawPath: string): Promise<void> {
  const withLeading = normalizePath(rawPath)
  if (!withLeading) return
  if (await removeCatalogApiUpload(withLeading)) return
  await removePublicAsset(withLeading)
}
