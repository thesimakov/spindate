/**
 * Боты в Spindate формируются на сервере в `ensureTableAuthority` через
 * `composeTablePlayers` + `generateBots` (см. table-authority-server).
 * Отдельный процесс «BotManager» не держит состояние: достаточно держать
 * maxPlayers=10 и перед выдачей снапшота вызывать ensureTableAuthority.
 *
 * Чат: боты не пишут в room chat (только живые игроки).
 */
export const ROOM_MAX_PLAYERS = 10
