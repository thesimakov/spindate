import { NextResponse } from "next/server"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { requireAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }
const MAX_FILE_BYTES = 8 * 1024 * 1024

function extensionFromFile(file: File): string {
  const byType: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
  }
  if (byType[file.type]) return byType[file.type]
  const idx = file.name.lastIndexOf(".")
    if (idx > -1) {
    const ext = file.name.slice(idx).toLowerCase()
      if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp" || ext === ".gif" || ext === ".svg") {
      return ext === ".jpeg" ? ".jpg" : ext
    }
  }
  return ".webp"
}

export async function POST(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const form = await req.formData()
    const filePart = form.get("file")
    const rawBucket = typeof form.get("bucket") === "string" ? String(form.get("bucket")) : ""
    const bucket = rawBucket.replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "misc"
    if (!(filePart instanceof File)) {
      return NextResponse.json({ ok: false, error: "file_required" }, { status: 400, headers: NO_CACHE })
    }
    if (filePart.size <= 0) {
      return NextResponse.json({ ok: false, error: "empty_file" }, { status: 400, headers: NO_CACHE })
    }
    if (filePart.size > MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400, headers: NO_CACHE })
    }
    if (!filePart.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "invalid_file_type" }, { status: 400, headers: NO_CACHE })
    }

    const ext = extensionFromFile(filePart)
    const fileName = `catalog-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
    const relDir = path.join("assets", bucket)
    const absDir = path.join(process.cwd(), "public", relDir)
    await mkdir(absDir, { recursive: true })

    const arrayBuffer = await filePart.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const absTarget = path.join(absDir, fileName)
    await writeFile(absTarget, buffer)

    const publicPath = `/${relDir.replaceAll("\\", "/")}/${fileName}`
    return NextResponse.json({ ok: true, path: publicPath }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}
