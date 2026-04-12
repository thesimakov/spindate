/**
 * Вызовы Bot API для счетов в Telegram Stars (XTR).
 * @see https://core.telegram.org/bots/api#createinvoicelink
 */

export async function telegramBotApi<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_PAYMENTS_BOT_TOKEN?.trim()
  if (!token) {
    throw new Error("TELEGRAM_PAYMENTS_BOT_TOKEN не задан")
  }
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const j = (await r.json()) as { ok: boolean; result?: T; description?: string }
  if (!j.ok) {
    throw new Error(j.description ?? "telegram_api_error")
  }
  return j.result as T
}

export async function createStarsInvoiceLink(input: {
  title: string
  description: string
  payload: string
  stars: number
}): Promise<string> {
  const { title, description, payload, stars } = input
  if (payload.length < 1 || payload.length > 128) {
    throw new Error("invoice_payload_invalid")
  }
  return telegramBotApi<string>("createInvoiceLink", {
    title: title.slice(0, 32),
    description: description.slice(0, 255),
    payload,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: title.slice(0, 32), amount: stars }],
  })
}

export async function answerPreCheckoutQueryOk(preCheckoutQueryId: string): Promise<void> {
  await telegramBotApi("answerPreCheckoutQuery", {
    pre_checkout_query_id: preCheckoutQueryId,
    ok: true,
  })
}

export async function answerPreCheckoutQueryError(preCheckoutQueryId: string, errorMessage: string): Promise<void> {
  await telegramBotApi("answerPreCheckoutQuery", {
    pre_checkout_query_id: preCheckoutQueryId,
    ok: false,
    error_message: errorMessage.slice(0, 200),
  })
}
