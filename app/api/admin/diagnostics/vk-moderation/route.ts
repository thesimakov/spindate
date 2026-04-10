import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"

const VK_API_DEFAULT_VERSION = "5.199"

function parseAdminVkUserId(raw: string | undefined): number | null {
  if (!raw) return null
  const n = Number(raw.trim())
  if (!Number.isSafeInteger(n) || n <= 0) return null
  return n
}

export async function GET(req: Request) {
  const deny = requireAdmin(req)
  if (deny) return deny

  const token = process.env.VK_MODERATION_GROUP_TOKEN?.trim()
  const adminVkUserIdRaw = process.env.VK_MODERATION_ADMIN_USER_ID?.trim()
  const adminVkUserId = parseAdminVkUserId(adminVkUserIdRaw)
  const version = process.env.VK_MODERATION_API_VERSION?.trim() || VK_API_DEFAULT_VERSION

  const base = {
    hasToken: Boolean(token),
    hasAdminUserId: Boolean(adminVkUserIdRaw),
    adminUserIdValid: adminVkUserId != null,
    apiVersion: version,
  }

  if (!token) {
    return NextResponse.json({
      ok: true,
      ...base,
      tokenValid: false,
      hint: "Добавьте VK_MODERATION_GROUP_TOKEN в .env.local на сервере и выполните pm2 restart spindate",
    })
  }

  if (!adminVkUserIdRaw || adminVkUserId == null) {
    return NextResponse.json({
      ok: true,
      ...base,
      tokenValid: true,
      hint: "Задайте корректный VK_MODERATION_ADMIN_USER_ID (целое число > 0)",
    })
  }

  try {
    const meRes = await fetch("https://api.vk.com/method/users.get", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        access_token: token,
        v: version,
      }).toString(),
    })

    const meJson = (await meRes.json().catch(() => null)) as
      | { response?: Array<{ id?: number; first_name?: string; last_name?: string }>; error?: { error_msg?: string } }
      | null

    if (!meRes.ok || !meJson || meJson.error) {
      return NextResponse.json({
        ok: true,
        ...base,
        tokenValid: false,
        vkError: meJson?.error?.error_msg ?? null,
        hint: "Токен сообщества недействителен или не имеет доступа к messages.send",
      })
    }

    const botUser = meJson.response?.[0]
    return NextResponse.json({
      ok: true,
      ...base,
      tokenValid: true,
      actorUserId: botUser?.id ?? null,
      actorName:
        botUser && typeof botUser.first_name === "string"
          ? `${botUser.first_name} ${typeof botUser.last_name === "string" ? botUser.last_name : ""}`.trim()
          : null,
      hint: "Параметры заданы. Проверьте отправкой тестового объявления в тикере и логи [admin-vk].",
    })
  } catch (e) {
    const err = e as Error & { code?: string; cause?: unknown }
    const cause = err.cause as { code?: string; message?: string } | undefined
    return NextResponse.json({
      ok: false,
      ...base,
      error: err.message || "fetch_failed",
      errorCode: err.code ?? cause?.code,
      hint: "Сервер не может достучаться до api.vk.com. Проверьте сеть/фаервол и DNS на VPS.",
    })
  }
}
