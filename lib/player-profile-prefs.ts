import type { Player } from "@/lib/game-types"

/** Эффективно: блок ВК скрыт только при явном false (на игроке или в legacy-Record). */
export function effectiveShowVkAfterCare(
  p: Player,
  courtshipFallback?: Record<number, boolean>,
): boolean {
  if (p.showVkAfterCare === false) return false
  if (p.showVkAfterCare === true) return true
  return courtshipFallback?.[p.id] !== false
}

/** Эффективно: приглашения только при явном true. */
export function effectiveOpenToChatInvites(
  p: Player,
  inviteFallback?: Record<number, boolean>,
): boolean {
  if (p.openToChatInvites === true) return true
  if (p.openToChatInvites === false) return false
  return inviteFallback?.[p.id] === true
}
