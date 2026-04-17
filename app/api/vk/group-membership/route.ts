import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getGameUserIdFromRequest } from "@/lib/user-request-auth"
import { vkGroupsIsMember } from "@/lib/vk-groups-server"

const COMMUNITY_GROUP_ID = 236519647
const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function POST(req: Request) {
  const auth = getGameUserIdFromRequest(req)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Не авторизован" }, { status: 401, headers: NO_CACHE })
  }

  if (auth.okUserId != null) {
    return NextResponse.json(
      { ok: false, error: "Проверка доступна только аккаунтам ВКонтакте" },
      { status: 400, headers: NO_CACHE },
    )
  }

  let vkUserId: number | null = auth.vkUserId
  if (vkUserId == null && auth.userId) {
    const db = getDb()
    const row = db
      .prepare(`SELECT vk_user_id FROM users WHERE id = ?`)
      .get(auth.userId) as { vk_user_id: number | null } | undefined
    const resolved = row?.vk_user_id
    if (typeof resolved === "number" && Number.isInteger(resolved) && resolved > 0) {
      vkUserId = resolved
    }
  }

  if (vkUserId == null) {
    return NextResponse.json(
      { ok: false, error: "VK аккаунт не привязан" },
      { status: 400, headers: NO_CACHE },
    )
  }

  const memberCheck = await vkGroupsIsMember({ groupId: COMMUNITY_GROUP_ID, userId: vkUserId })
  if (!memberCheck.ok) {
    if (memberCheck.reason === "missing_service_token") {
      return NextResponse.json(
        { ok: false, error: "Сервер не настроен для проверки подписки", reason: memberCheck.reason },
        { status: 503, headers: NO_CACHE },
      )
    }
    return NextResponse.json(
      { ok: false, error: "Не удалось проверить подписку", reason: memberCheck.reason },
      { status: 502, headers: NO_CACHE },
    )
  }

  return NextResponse.json({ ok: true, isMember: memberCheck.member }, { headers: NO_CACHE })
}
