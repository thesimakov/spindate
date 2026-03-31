import { NextResponse } from "next/server"
import crypto from "crypto"

function getAppId() {
  const id = process.env.NEXT_PUBLIC_VK_APP_ID ?? process.env.VK_APP_ID ?? ""
  return typeof id === "string" && id.trim() ? id.trim() : ""
}

function getSecretKey() {
  const key = process.env.VK_SECRET_KEY ?? process.env.VK_APP_SECRET_KEY
  return typeof key === "string" && key.trim() ? key.trim() : ""
}

function generateOrderId(userId: string, amount: number) {
  const base = `${userId || "anon"}:${amount}:${Date.now()}:${Math.random()}`
  return crypto.createHash("sha256").update(base).digest("hex").slice(0, 32)
}

function signPayload(payload: Record<string, unknown>, secret: string) {
  const keys = Object.keys(payload).sort()
  const data = keys.map((k) => `${k}=${String(payload[k] ?? "")}`).join("&")
  return crypto.createHmac("sha256", secret).update(data).digest("hex")
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      amount?: number
      userId?: string
      description?: string
      currency?: string
    }

    const amount = Number(body.amount)
    const userId = typeof body.userId === "string" ? body.userId : ""
    const description = typeof body.description === "string" ? body.description.slice(0, 128) : "Пополнение сердечек"

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 })
    }

    const appId = getAppId()
    if (!appId) {
      return NextResponse.json({ ok: false, error: "no_app_id" }, { status: 500 })
    }

    const secret = getSecretKey()
    if (!secret) {
      return NextResponse.json({ ok: false, error: "no_secret" }, { status: 500 })
    }

    const orderId = generateOrderId(userId, amount)

    const signPayloadData: Record<string, unknown> = {
      amount,
      description,
      order_id: orderId,
      user_id: userId,
      currency: "votes",
      app_id: Number(appId),
    }

    const sign = signPayload(signPayloadData, secret)

    return NextResponse.json({
      ok: true,
      app_id: Number(appId),
      order_id: orderId,
      sign,
    })
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 })
  }
}
