import type { Gender, Player } from "@/lib/game-types"

type ComposeArgs = {
  currentUser: Player
  livePlayers: Player[]
  existingPlayers?: Player[]
  maxTableSize: number
  targetMales: number
  targetFemales: number
  botPool: Player[]
}

function uniqueLivePlayers(livePlayers: Player[], currentUser: Player): Player[] {
  const byId = new Map<number, Player>()
  for (const p of livePlayers) {
    if (p.isBot) continue
    byId.set(p.id, p)
  }
  byId.set(currentUser.id, { ...currentUser, isBot: false })
  return Array.from(byId.values())
}

function pickBotsByGender(
  bots: Player[],
  selectedIds: Set<number>,
  gender: Gender,
  count: number,
): Player[] {
  if (count <= 0) return []
  const out: Player[] = []
  for (const bot of bots) {
    if (out.length >= count) break
    if (selectedIds.has(bot.id)) continue
    if (!bot.isBot || bot.gender !== gender) continue
    out.push(bot)
    selectedIds.add(bot.id)
  }
  return out
}

function pickAnyBots(
  bots: Player[],
  selectedIds: Set<number>,
  count: number,
): Player[] {
  if (count <= 0) return []
  const out: Player[] = []
  for (const bot of bots) {
    if (out.length >= count) break
    if (selectedIds.has(bot.id)) continue
    if (!bot.isBot) continue
    out.push(bot)
    selectedIds.add(bot.id)
  }
  return out
}

export function composeTablePlayers({
  currentUser,
  livePlayers,
  existingPlayers = [],
  maxTableSize,
  targetMales,
  targetFemales,
  botPool,
}: ComposeArgs): Player[] {
  const live = uniqueLivePlayers(livePlayers, currentUser).slice(0, Math.max(1, maxTableSize))
  const liveCount = live.length
  const neededBots = Math.max(0, maxTableSize - liveCount)

  const liveMales = live.filter((p) => p.gender === "male").length
  const liveFemales = live.filter((p) => p.gender === "female").length
  const needMalesFromBots = Math.max(0, targetMales - liveMales)
  const needFemalesFromBots = Math.max(0, targetFemales - liveFemales)

  const liveIds = new Set(live.map((p) => p.id))
  const selectedBotIds = new Set<number>()
  const existingBots = existingPlayers.filter((p) => !!p.isBot && !liveIds.has(p.id))
  const freshBots = botPool.filter((p) => !!p.isBot && !liveIds.has(p.id))
  const botCandidates = [...existingBots, ...freshBots]

  const selectedByGender = [
    ...pickBotsByGender(botCandidates, selectedBotIds, "male", needMalesFromBots),
    ...pickBotsByGender(botCandidates, selectedBotIds, "female", needFemalesFromBots),
  ]
  const selectedBots = [
    ...selectedByGender,
    ...pickAnyBots(botCandidates, selectedBotIds, Math.max(0, neededBots - selectedByGender.length)),
  ].slice(0, neededBots)

  const finalMap = new Map<number, Player>()
  for (const p of [...live, ...selectedBots]) finalMap.set(p.id, p)

  // Сохраняем порядок мест насколько возможно, чтобы стол не "прыгал" при синхронизации.
  const ordered: Player[] = []
  for (const prev of existingPlayers) {
    const next = finalMap.get(prev.id)
    if (!next) continue
    ordered.push(next)
    finalMap.delete(prev.id)
  }
  ordered.push(...finalMap.values())
  const merged = ordered.slice(0, maxTableSize)

  // Живые игроки всегда впереди, боты только добор — при подключении нового человека
  // лишние боты отваливаются (neededBots уменьшается), а не «толкают» живых.
  const humans = merged.filter((p) => !p.isBot)
  const bots = merged.filter((p) => p.isBot)
  return [...humans, ...bots].slice(0, maxTableSize)
}
