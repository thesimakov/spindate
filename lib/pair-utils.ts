import type { Gender, Player } from "@/lib/game-types"

export function getPairGenderCombo(p1: Player, p2: Player): "MM" | "MF" | "FF" {
  if (p1.gender === "male" && p2.gender === "male") return "MM"
  if (p1.gender === "female" && p2.gender === "female") return "FF"
  return "MF"
}

/** Пол противоположный переданному (для фильтра цели бутылочки). */
export function oppositeGender(g: Gender): Gender {
  return g === "male" ? "female" : "male"
}

/** Игроки подходящего пола, кроме крутящего (для правила «бутылка только на противоположный пол»). */
export function filterOppositeGenderOthers(players: Player[], spinner: Player): Player[] {
  const want = oppositeGender(spinner.gender)
  return players.filter((p) => p.id !== spinner.id && p.gender === want)
}
