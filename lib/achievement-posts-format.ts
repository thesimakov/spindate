export type AchievementPostTemplateInput = {
  template: string
  playerName: string
  achievementTitle: string
  gameUrl: string
}

export function formatAchievementPostText(input: AchievementPostTemplateInput): string {
  const safeName = input.playerName.trim() || "Игрок"
  const safeAchievement = input.achievementTitle.trim() || "Достижение"
  const safeGameUrl = input.gameUrl.trim()
  const source = input.template.trim()
  const base =
    source ||
    `Игрок {name} получил достижение «{achievement}» в Крути и знакомься!\n{game_url}`
  return base
    .replaceAll("{name}", safeName)
    .replaceAll("{achievement}", safeAchievement)
    .replaceAll("{game_url}", safeGameUrl)
    .slice(0, 1200)
}
