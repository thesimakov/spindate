import type { TableAuthorityPayload } from "@/lib/game-types"

/**
 * Купленный на 30 мин скин бутылки: по истечении `bottleCooldownUntil` сбрасываем на classic (на клиенте «главная» = main через effectiveBottleSkin).
 */
export function authoritySnapshotExpiredBottleLease(
  snapshot: TableAuthorityPayload,
  nowMs: number = Date.now(),
): { snapshot: TableAuthorityPayload; changed: boolean } {
  const cd = snapshot.bottleCooldownUntil
  if (typeof cd !== "number" || !Number.isFinite(cd) || cd > nowMs) {
    return { snapshot, changed: false }
  }
  return {
    snapshot: {
      ...snapshot,
      bottleSkin: "classic",
      bottleCooldownUntil: undefined,
      bottleDonorId: undefined,
      bottleDonorName: undefined,
    },
    changed: true,
  }
}
