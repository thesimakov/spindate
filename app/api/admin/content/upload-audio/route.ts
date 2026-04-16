import { NextResponse } from "next/server"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { requireAdmin } from "@/lib/admin-auth"
import { catalogUploadPublicPath, getCatalogUploadRoot } from "@/lib/catalog-upload-paths"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }
const MAX_FILE_BYTES = 8 * 1024 * 1024

const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
])

function extensionFromFile(file: File): string {
  const byType: Record<string, string> = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/aac": ".aac",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "audio/opus": ".opus",
    "audio/webm": ".webm",
  }
  if (byType[file.type]) return byType[file.type]
  const idx = file.name.lastIndexOf(".")
  if (idx > -1) {
    const ext = file.name.slice(idx).toLowerCase()
    if ([".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".webm"].includes(ext)) {
      return ext
    }
  }
  return ".mp3"
}

export async function POST(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const form = await req.formData()
    const filePart = form.get("file")
    const rawBucket = typeof form.get("bucket") === "string" ? String(form.get("bucket")) : ""
    const bucket = rawBucket.replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "gift_music"
    if (bucket !== "gift_music") {
      return NextResponse.json({ ok: false, error: "invalid_bucket" }, { status: 400, headers: NO_CACHE })
    }
    if (!(filePart instanceof File)) {
      return NextResponse.json({ ok: false, error: "file_required" }, { status: 400, headers: NO_CACHE })
    }
    if (filePart.size <= 0) {
      return NextResponse.json({ ok: false, error: "empty_file" }, { status: 400, headers: NO_CACHE })
    }
    if (filePart.size > MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400, headers: NO_CACHE })
    }
    const nameIdx = filePart.name.lastIndexOf(".")
    const extFromName = nameIdx > -1 ? filePart.name.slice(nameIdx).toLowerCase() : ""
    const extOk = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus", ".webm"].includes(extFromName)
    if (!AUDIO_TYPES.has(filePart.type) && filePart.type !== "" && !extOk) {
      return NextResponse.json({ ok: false, error: "invalid_file_type" }, { status: 400, headers: NO_CACHE })
    }

    const ext = extensionFromFile(filePart)
    const fileName = `catalog-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
    const absDir = path.join(getCatalogUploadRoot(), bucket)
    await mkdir(absDir, { recursive: true })

    const arrayBuffer = await filePart.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const absTarget = path.join(absDir, fileName)
    await writeFile(absTarget, buffer)

    const publicPath = catalogUploadPublicPath(bucket, fileName)
    return NextResponse.json({ ok: true, path: publicPath }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}
