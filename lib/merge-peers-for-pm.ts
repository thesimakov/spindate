import type { Player } from "@/lib/game-types"

/** Избранные без изменений; поклонники без тех, кто уже в избранном. */
export function splitFavoritesAndAdmirersPeers(
  favorites: Player[],
  admirers: Player[],
): { favoritesRows: Player[]; admirersRows: Player[] } {
  const favIds = new Set(favorites.map((p) => p.id))
  return {
    favoritesRows: favorites,
    admirersRows: admirers.filter((a) => !favIds.has(a.id)),
  }
}

/** Один список peer для API непрочитанных: избранные первыми, затем остальные поклонники. */
export function mergePeersForUnreadPoll(favorites: Player[], admirers: Player[]): Player[] {
  const { favoritesRows, admirersRows } = splitFavoritesAndAdmirersPeers(favorites, admirers)
  return [...favoritesRows, ...admirersRows]
}
