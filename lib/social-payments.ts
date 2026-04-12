import { showPaymentWall } from "@/lib/vk-bridge"
import type { RuntimeHost } from "@/lib/social-runtime"

/**
 * Оплата во встроенном приложении: ВК — текущий bridge; ОК — пока без FAPI-платежей (false).
 */
export async function showEmbeddedPaymentWall(
  runtimeHost: RuntimeHost,
  cost: number,
  itemId?: string,
  meta?: { userId?: string; description?: string },
): Promise<boolean> {
  if (runtimeHost === "vk") {
    return showPaymentWall(cost, itemId, meta)
  }
  if (runtimeHost === "ok") {
    return false
  }
  return false
}
