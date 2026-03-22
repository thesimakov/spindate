import type { Player } from "@/lib/game-types"

export function getPairGenderCombo(p1: Player, p2: Player): "MM" | "MF" | "FF" {
  if (p1.gender === "male" && p2.gender === "male") return "MM"
  if (p1.gender === "female" && p2.gender === "female") return "FF"
  return "MF"
}
