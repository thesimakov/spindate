import { createHash, timingSafeEqual } from "node:crypto"

/**
 * Подпись уведомлений VK Payments (как в github.com/SevereCloud/vksdk payments).
 * Строка: пары key=value по именам параметров в алфавитном порядке (sig не участвует),
 * затем secret из настроек приложения; md5 → hex.
 * @see https://dev.vk.ru/ru/api/payments/notifications/overview
 */
export function vkPaymentsConcatForSign(params: URLSearchParams): string {
  const keys = [...new Set([...params.keys()])]
    .filter((k) => k !== "sig")
    .sort()
  let buf = ""
  for (const k of keys) {
    for (const v of params.getAll(k)) {
      buf += `${k}=${v}`
    }
  }
  return buf
}

export function vkPaymentsComputeSig(concat: string, secret: string): string {
  return createHash("md5").update(concat + secret, "utf8").digest("hex")
}

export function verifyVkPaymentsSig(params: URLSearchParams, sig: string | undefined, secret: string): boolean {
  if (!secret || !sig) return false
  const expected = vkPaymentsComputeSig(vkPaymentsConcatForSign(params), secret)
  if (expected.length !== sig.length) return false
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(sig, "utf8"))
}
