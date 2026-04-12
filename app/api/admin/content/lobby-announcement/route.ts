import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getLobbyAnnouncement, updateLobbyAnnouncement } from "@/lib/lobby-announcement-server"

export const dynamic = "force-dynamic"

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

function serialize(row: NonNullable<ReturnType<typeof getLobbyAnnouncement>>) {
  return {
    title: row.title,
    body: row.body,
    buttonLabel: row.buttonLabel,
    imageUrl: row.imageUrl,
    published: row.published,
    deleted: row.deleted,
    updatedAt: row.updatedAt,
  }
}

export async function GET(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const row = getLobbyAnnouncement()
    if (!row) {
      return NextResponse.json(
        {
          ok: true,
          row: {
            title: "",
            body: "",
            buttonLabel: "",
            imageUrl: "",
            published: false,
            deleted: false,
            updatedAt: 0,
          },
        },
        { headers: NO_CACHE },
      )
    }
    return NextResponse.json({ ok: true, row: serialize(row) }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}

export async function POST(req: Request) {
  const denied = requireAdmin(req)
  if (denied) return denied
  try {
    const body = await req.json().catch(() => null)
    const row = updateLobbyAnnouncement({
      title: typeof body?.title === "string" ? body.title : undefined,
      body: typeof body?.body === "string" ? body.body : undefined,
      buttonLabel: typeof body?.buttonLabel === "string" ? body.buttonLabel : undefined,
      imageUrl: typeof body?.imageUrl === "string" ? body.imageUrl : undefined,
      published: typeof body?.published === "boolean" ? body.published : undefined,
      deleted: typeof body?.deleted === "boolean" ? body.deleted : undefined,
    })
    return NextResponse.json({ ok: true, row: serialize(row) }, { headers: NO_CACHE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_CACHE })
  }
}
