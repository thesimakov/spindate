import { NextResponse } from "next/server"
import { runRoomChatPurgeJob } from "@/lib/rooms/chat-purge-scheduler"

function cronSecret(): string | null {
  const s = process.env.CRON_SECRET?.trim()
  return s && s.length > 0 ? s : null
}

function authorized(req: Request, secret: string): boolean {
  const auth = req.headers.get("authorization")?.trim()
  const bearer =
    auth && auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null
  const header = req.headers.get("x-cron-secret")?.trim()
  return bearer === secret || header === secret
}

/**
 * Ровно одна очистка на весь кластер: вызывать из crontab / Vercel Cron в 00:00 МСК.
 * Заголовок: `Authorization: Bearer <CRON_SECRET>` или `X-Cron-Secret: <CRON_SECRET>`.
 * Без `CRON_SECRET` в окружении — 404 (маршрут «скрыт»).
 */
export async function POST(req: Request) {
  const secret = cronSecret()
  if (!secret) {
    return new NextResponse(null, { status: 404 })
  }
  if (!authorized(req, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  try {
    await runRoomChatPurgeJob()
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[room-chat-purge] cron POST", e)
    return NextResponse.json({ ok: false, error: "purge_failed" }, { status: 500 })
  }
}
