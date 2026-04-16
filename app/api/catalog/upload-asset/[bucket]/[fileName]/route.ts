import { NextResponse } from "next/server"
import path from "node:path"
import { readFile } from "node:fs/promises"
import {
  getCatalogUploadRoot,
  isAllowedCatalogUploadBucket,
  isAllowedCatalogUploadFileName,
} from "@/lib/catalog-upload-paths"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".webm": "audio/webm",
}

export async function GET(_req: Request, ctx: { params: Promise<{ bucket: string; fileName: string }> }) {
  const { bucket, fileName } = await ctx.params
  if (!isAllowedCatalogUploadBucket(bucket) || !isAllowedCatalogUploadFileName(bucket, fileName)) {
    return new NextResponse("Not Found", { status: 404 })
  }

  const root = path.resolve(getCatalogUploadRoot())
  const absTarget = path.resolve(root, bucket, fileName)
  const bucketRoot = path.resolve(root, bucket)
  if (!absTarget.startsWith(bucketRoot + path.sep) && absTarget !== bucketRoot) {
    return new NextResponse("Not Found", { status: 404 })
  }

  try {
    const buf = await readFile(absTarget)
    const ext = path.extname(fileName).toLowerCase()
    const type = EXT_MIME[ext] ?? "application/octet-stream"
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch {
    return new NextResponse("Not Found", { status: 404 })
  }
}
